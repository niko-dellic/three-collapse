import * as THREE from "three";

import { WorkerPool } from "../utils/WorkerPool";
import { ModelTile3DConfig, WFC3DError } from "../wfc3d";
import { DebugUI, prepareTilesForWorker, validateTileset } from "../utils";
import { DebugGrid } from "../utils/DebugGrid";
import { InstancedModelRenderer } from "../renderers/InstancedModelRenderer";
import { GLBTileLoader } from "../loaders/GLBTileLoader";
import { generateWithWorkers } from "../utils/MultiWorkerGenerator";
import type {
  WFCGeneratorOptions,
  GenerateOptions,
  ExpandOptions,
  TileTransformOverride,
} from "../types";

/**
 * Main WFC Generator class - handles all worker management, generation, expansion, retries, and rendering
 */
export class WFCGenerator {
  private tiles: ModelTile3DConfig[];
  private workerPool: WorkerPool;
  private maxRetries: number = 3;
  private seed: number = Date.now();
  private debugGrid: DebugGrid | null = null;
  private renderer: InstancedModelRenderer;
  private scene: THREE.Scene;
  private cellSize: number = 1;

  // State for expansion - now using sparse map
  private grid: Map<string, string> | null = null;
  private width: number = 8;
  private height: number = 1;
  private depth: number = 8;

  // Track which cells are enabled for rendering
  private enabledCells: Set<string> = new Set();

  // Track actual bounds of sparse grid
  private gridBounds = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
  };

  // Collapse options for re-collapsing from UI
  private loader: GLBTileLoader = new GLBTileLoader();

  // ui
  private debugUI: DebugUI | null = null;

  // Completion callbacks
  private onCollapseComplete: Record<string, () => void> = {};

  /**
   * Create a new WFC Generator
   * @param tiles - Array of tile configurations
   * @param options - Generator options
   */
  constructor(tiles: ModelTile3DConfig[], options: WFCGeneratorOptions) {
    this.tiles = tiles;
    this.scene = options.scene;
    if (options.maxRetries) this.maxRetries = options.maxRetries;
    if (options.seed) this.seed = options.seed;
    if (options.width) this.width = options.width;
    if (options.height) this.height = options.height;
    if (options.depth) this.depth = options.depth;
    if (options.cellSize) this.cellSize = options.cellSize;

    this.renderer = new InstancedModelRenderer(this.scene, this.cellSize);

    // Validate tileset
    validateTileset(this.tiles);

    // Create worker pool
    const workerCount =
      options.workerCount ?? (navigator.hardwareConcurrency || 4);
    this.workerPool = new WorkerPool(workerCount);

    if (options.debug) {
      this.debugGrid = new DebugGrid(this.scene, this.cellSize);
      this.debugUI = new DebugUI(this);
    }
  }

  /**
   * Generate a new WFC grid
   * @param options - Generation options
   * @returns Promise resolving to the generated sparse grid map
   */
  async generate(options: GenerateOptions = {}): Promise<Map<string, string>> {
    this.reset();
    const { width, height, depth } = this.getDimensions();

    this.debugUI?.showProgress("Loading GLB models...");
    this.debugUI?.setProgress(0);
    const modelData = await this.loader.loadTileset(this.tiles);
    this.renderer.updateTileset(modelData);
    this.debugUI?.setProgress(10);

    const seed = options.seed ?? this.seed;
    let attempt = 0;
    let lastError: Error | null = null;

    // Show progress
    this.debugUI?.showProgress("Running WFC algorithm...");
    this.debugUI?.setProgress(0);

    // Store dimensions for expansion
    this.width = width;
    this.height = height;
    this.depth = depth;

    // Retry loop
    while (attempt < this.maxRetries) {
      attempt++;

      try {
        // Use unified collapse method
        const result = await this.runCollapse(
          {
            minX: 0,
            maxX: width,
            minY: 0,
            maxY: height,
            minZ: 0,
            maxZ: depth,
          },
          null, // Render all cells
          seed + attempt - 1,
          options
        );

        // Store for expansion if enabled
        this.grid = result;

        // Update grid bounds
        this.updateGridBounds();

        // Update debug grid (generate always starts at origin)
        if (this.debugGrid) {
          this.debugGrid.updateGrid(
            width,
            height,
            depth,
            0, // Grid always starts at origin for generate
            0,
            0
          );
        }

        // Show completion
        const stats = this.renderer.getStats();
        this.debugUI?.showProgress(
          `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`
        );
        this.debugUI?.setProgress(100);
        setTimeout(() => this.debugUI?.hideProgress(), 2000);

        // Trigger completion callbacks
        this.triggerCompleteCallbacks();

        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Generation error (attempt ${attempt}/${this.maxRetries}):`,
          error
        );

        // Check if error has WFC3DError details
        const wfcError = (error as any).wfcError as WFC3DError | undefined;
        if (wfcError) console.error("WFC Error Details:", wfcError);

        // If we have retries left and it's a WFC error, try again
        if (attempt < this.maxRetries && wfcError?.type) {
          console.log(`Retrying with new seed...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        // No more retries
        break;
      }
    }

    // All retries exhausted
    const errorMessage = `Generation failed after ${
      this.maxRetries
    } attempts: ${lastError?.message || "Unknown error"}`;

    this.debugUI?.showProgress(
      `Failed: ${lastError?.message || "Unknown error"}`
    );
    this.debugUI?.setProgress(0);
    this.debugUI?.setProgressColor("#ef4444");
    setTimeout(() => {
      this.debugUI?.setProgressColor("var(--focus-color)");
      this.debugUI?.hideProgress();
    }, 3000);

    throw new Error(errorMessage);
  }

  /**
   * Unified collapse method for both generation and expansion
   * @param bounds - Region bounds to collapse
   * @param cellsToEnable - Cells to render (null = render all)
   * @param seed - Random seed
   * @param options - Generation or expansion options
   * @returns Promise resolving to the collapsed sparse grid map
   */
  private async runCollapse(
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minZ: number;
      maxZ: number;
    },
    cellsToEnable: Array<[number, number, number]> | null,
    seed: number,
    options: GenerateOptions | ExpandOptions
  ): Promise<Map<string, string>> {
    // Calculate dimensions from bounds
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const depth = bounds.maxZ - bounds.minZ;

    // Initialize sparse grid
    const internalGrid = this.createEmptyMap();

    // Build preCollapsedCells array from existing grid
    const preCollapsedCells: Array<{
      x: number;
      y: number;
      z: number;
      tileId: string;
    }> = [];

    if (this.grid) {
      for (const [key, tileId] of this.grid.entries()) {
        if (!tileId) continue;
        const [worldX, worldY, worldZ] = this.keyToCoord(key);

        // Only include cells within the bounds
        if (
          worldX >= bounds.minX &&
          worldX < bounds.maxX &&
          worldY >= bounds.minY &&
          worldY < bounds.maxY &&
          worldZ >= bounds.minZ &&
          worldZ < bounds.maxZ
        ) {
          preCollapsedCells.push({
            x: worldX - bounds.minX, // Convert to buffer-local coordinates
            y: worldY - bounds.minY,
            z: worldZ - bounds.minZ,
            tileId,
          });
        }
      }
    }

    const workerCount = this.workerPool.getWorkerCount();
    console.log(
      `Running collapse on ${width}x${height}x${depth} region with ${preCollapsedCells.length} pre-collapsed cells`
    );
    console.log(`Worker pool: ${workerCount} workers available`);

    // Start performance timer
    const startTime = performance.now();

    // Create set of cells to enable for fast lookup
    const cellsToEnableSet =
      cellsToEnable !== null
        ? new Set(cellsToEnable.map(([x, y, z]) => this.coordToKey(x, y, z)))
        : null;

    try {
      let result: string[][][];

      // Use region-based parallelization for multiple workers
      if (workerCount > 1) {
        console.log(
          `Using region-based parallelization with ${workerCount} workers`
        );

        result = await generateWithWorkers(
          width,
          height,
          depth,
          prepareTilesForWorker(this.tiles),
          this.workerPool,
          seed,
          options.onProgress,
          (x: number, y: number, z: number, tileId: string) => {
            // Convert buffer-local coordinates to world coordinates
            const worldX = x + bounds.minX;
            const worldY = y + bounds.minY;
            const worldZ = z + bounds.minZ;
            const key = this.coordToKey(worldX, worldY, worldZ);

            // Update internal sparse grid
            internalGrid.set(key, tileId);

            // Check if this cell should be rendered
            const shouldRender =
              cellsToEnableSet === null || cellsToEnableSet.has(key);

            if (shouldRender) {
              // Render tile in real-time
              if (this.renderer) {
                this.renderer.addTileInstance(tileId, worldX, worldY, worldZ);
              }
              // Mark as enabled
              this.enabledCells.add(key);
            }

            // Call user callback
            if (options.onTileUpdate) {
              options.onTileUpdate(worldX, worldY, worldZ, tileId);
            }
          }
        );
      } else {
        // Single worker - use direct task execution
        console.log(`Using single worker execution`);

        result = await this.workerPool.executeTask({
          id: `collapse_${Date.now()}_${Math.random()}`,
          message: {
            type: "generate",
            width,
            height,
            depth,
            tiles: prepareTilesForWorker(this.tiles),
            seed,
            preCollapsedCells,
          },
          onTileUpdate: (x: number, y: number, z: number, tileId: string) => {
            // Convert buffer-local coordinates to world coordinates
            const worldX = x + bounds.minX;
            const worldY = y + bounds.minY;
            const worldZ = z + bounds.minZ;
            const key = this.coordToKey(worldX, worldY, worldZ);

            // Update internal sparse grid
            internalGrid.set(key, tileId);

            // Check if this cell should be rendered
            const shouldRender =
              cellsToEnableSet === null || cellsToEnableSet.has(key);

            if (shouldRender) {
              // Render tile in real-time
              if (this.renderer) {
                this.renderer.addTileInstance(tileId, worldX, worldY, worldZ);
              }
              // Mark as enabled
              this.enabledCells.add(key);
            }

            // Call user callback
            if (options.onTileUpdate) {
              options.onTileUpdate(worldX, worldY, worldZ, tileId);
            }
          },
        });
      }

      // Convert array response to sparse map (with world coordinates)
      // Only add cells that should be included based on cellsToEnable
      const resultMap = this.createEmptyMap();
      for (let x = 0; x < result.length; x++) {
        for (let y = 0; y < result[x].length; y++) {
          for (let z = 0; z < result[x][y].length; z++) {
            const tileId = result[x][y][z];
            if (tileId) {
              const worldX = x + bounds.minX;
              const worldY = y + bounds.minY;
              const worldZ = z + bounds.minZ;
              const key = this.coordToKey(worldX, worldY, worldZ);

              // Only add cells that:
              // 1. Were in cellsToEnable (new expansion cells or cells being made visible)
              // 2. OR already existed in the grid (pre-collapsed cells)
              const shouldInclude =
                cellsToEnableSet === null || // If null, include all cells
                cellsToEnableSet.has(key) || // Cell is in expansion region
                (this.grid && this.grid.has(key)); // Cell already existed

              if (shouldInclude) {
                resultMap.set(key, tileId);
              }
            }
          }
        }
      }

      // End performance timer
      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalCells = width * height * depth;
      const cellsPerSecond = (totalCells / (duration / 1000)).toFixed(0);

      console.log(
        `Collapse complete: ${resultMap.size} cells kept from ${totalCells} buffer cells`
      );
      console.log(
        `⏱️  Performance: ${duration.toFixed(
          2
        )}ms (${cellsPerSecond} cells/sec) using ${this.workerPool.getWorkerCount()} workers`
      );

      // Update debug UI with performance stats
      if (this.debugUI) {
        this.debugUI.showProgress(
          `✓ Complete in ${duration.toFixed(
            0
          )}ms (${this.workerPool.getWorkerCount()} workers)`
        );
        setTimeout(() => this.debugUI?.hideProgress(), 3000);
      }

      return resultMap;
    } catch (error) {
      const err: any = error;
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.error(
        `❌ Collapse failed after ${duration.toFixed(2)}ms:`,
        err.message
      );
      throw new Error(`Collapse failed: ${err.message || "Unknown error"}`);
    }
  }

  /**
   * Create an empty sparse map
   */
  private createEmptyMap(): Map<string, string> {
    return new Map();
  }

  /**
   * Helper to convert coordinates to map key
   */
  private coordToKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Helper to parse map key back to coordinates
   */
  private keyToCoord(key: string): [number, number, number] {
    const parts = key.split(",").map(Number);
    return [parts[0], parts[1], parts[2]];
  }

  /**
   * Convert sparse map to 3D array (for backward compatibility)
   * May be used by external consumers who need array format
   */
  mapToArray(grid: Map<string, string>): string[][][] {
    const array: string[][][] = [];

    for (let x = 0; x < this.width; x++) {
      array[x] = [];
      for (let y = 0; y < this.height; y++) {
        array[x][y] = [];
        for (let z = 0; z < this.depth; z++) {
          const key = this.coordToKey(x, y, z);
          array[x][y][z] = grid.get(key) || "";
        }
      }
    }

    return array;
  }

  /**
   * Expand the existing grid
   * @param newWidth - New grid width
   * @param newHeight - New grid height
   * @param newDepth - New grid depth
   * @param options - Expansion options
   * @returns Promise resolving to the expanded sparse grid map
   */
  async expand(
    newWidth: number,
    newHeight: number,
    newDepth: number,
    options: ExpandOptions = {}
  ): Promise<Map<string, string>> {
    if (!this.canExpand()) {
      throw new Error(
        "Cannot expand: no existing grid. Generate a grid first with autoExpansion enabled."
      );
    }

    const seed = options.seed ?? this.seed;

    // Show progress
    this.debugUI?.showProgress("Expanding grid...");
    this.debugUI?.setProgress(0);

    try {
      // For expand() from UI, we want the grid to remain at origin (0,0,0)
      // and expand to the new dimensions
      const targetMinX = 0;
      const targetMaxX = newWidth;
      const targetMinY = 0;
      const targetMaxY = newHeight;
      const targetMinZ = 0;
      const targetMaxZ = newDepth;

      // Identify new cells that need to be collapsed
      const newCells: Array<[number, number, number]> = [];
      for (let x = targetMinX; x < targetMaxX; x++) {
        for (let y = targetMinY; y < targetMaxY; y++) {
          for (let z = targetMinZ; z < targetMaxZ; z++) {
            const key = this.coordToKey(x, y, z);
            if (!this.grid!.has(key)) {
              newCells.push([x, y, z]);
            }
          }
        }
      }

      if (newCells.length === 0) {
        // No new cells to add
        this.debugUI?.hideProgress();
        return this.grid!;
      }

      // Use unified collapse with padding
      const PADDING = 2;
      const result = await this.runCollapse(
        {
          minX: targetMinX - PADDING,
          maxX: targetMaxX + PADDING,
          minY: targetMinY - PADDING,
          maxY: targetMaxY + PADDING,
          minZ: targetMinZ - PADDING,
          maxZ: targetMaxZ + PADDING,
        },
        newCells, // Only render new cells
        seed,
        options
      );

      // Update stored state
      this.width = newWidth;
      this.height = newHeight;
      this.depth = newDepth;
      this.grid = result;

      // Update grid bounds
      this.updateGridBounds();

      // Update debug grid (use target bounds for UI-driven expansion)
      if (this.debugGrid) {
        this.debugGrid.updateGrid(
          newWidth,
          newHeight,
          newDepth,
          0, // Grid starts at origin for UI-driven expansion
          0,
          0
        );
      }

      // Show completion
      const stats = this.renderer.getStats();
      this.debugUI?.showProgress(
        `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`
      );
      this.debugUI?.setProgress(100);
      setTimeout(() => this.debugUI?.hideProgress(), 2000);

      // Trigger completion callbacks
      this.triggerCompleteCallbacks();

      return result;
    } catch (error) {
      console.error("Expansion error:", error);

      this.debugUI?.showProgress(`Failed: ${(error as Error).message}`);
      this.debugUI?.setProgress(0);
      this.debugUI?.setProgressColor("#ef4444");
      setTimeout(() => {
        this.debugUI?.setProgressColor("var(--focus-color)");
        this.debugUI?.hideProgress();
      }, 3000);

      throw error;
    }
  }

  /**
   * Shrink the existing grid
   * @param newWidth - New grid width
   * @param newHeight - New grid height
   * @param newDepth - New grid depth
   * @returns The shrunk grid
   */
  async shrink(
    newWidth: number,
    newHeight: number,
    newDepth: number
  ): Promise<Map<string, string>> {
    if (!this.canExpand()) {
      throw new Error("Cannot shrink: no existing grid");
    }

    // Validate dimensions
    if (
      newWidth > this.width ||
      newHeight > this.height ||
      newDepth > this.depth
    )
      throw new Error(
        "Cannot shrink to larger dimensions. Use expand() instead."
      );

    const shrunkGrid = new Map<string, string>();

    // Copy only the cells within the new dimensions
    // Also update enabledCells
    const newEnabledCells = new Set<string>();
    for (const [key, tileId] of this.grid!.entries()) {
      const [x, y, z] = this.keyToCoord(key);
      if (x < newWidth && y < newHeight && z < newDepth) {
        shrunkGrid.set(key, tileId);
        if (this.enabledCells.has(key)) {
          newEnabledCells.add(key);
        }
      }
    }

    // Update stored state
    this.width = newWidth;
    this.height = newHeight;
    this.depth = newDepth;
    this.grid = shrunkGrid;
    this.enabledCells = newEnabledCells;

    // Update grid bounds
    this.updateGridBounds();

    // Update debug grid (use origin for UI-driven shrink)
    if (this.debugGrid) {
      this.debugGrid.updateGrid(
        newWidth,
        newHeight,
        newDepth,
        0, // Grid starts at origin for UI-driven shrink
        0,
        0
      );
    }

    this.renderer.render(shrunkGrid, this.enabledCells);

    return shrunkGrid;
  }

  /**
   * Check if expansion is possible
   */
  canExpand(): boolean {
    return this.grid !== null;
  }

  /**
   * Reset the generator state (clears expansion data and rendering)
   */
  reset(): void {
    this.grid = null;
    this.enabledCells.clear();
    this.renderer.clear();
  }

  /**
   * Update the tileset
   * @param tiles - New tile configurations
   */
  setTiles(tiles: ModelTile3DConfig[]): void {
    this.tiles = tiles;
    // Clear expansion state when tiles change
    this.reset();
  }

  /**
   * Update the seed
   * @param seed - New seed value
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }

  /**
   * Get the current seed
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Get the last generated grid
   */
  getLastGrid(): Map<string, string> | null {
    return this.grid;
  }

  /**
   * Check if a cell is on the periphery (has at least one non-existent neighbor)
   */
  isCellOnPeriphery(x: number, y: number, z: number): boolean {
    if (!this.grid) return false;

    const key = this.coordToKey(x, y, z);
    if (!this.grid.has(key)) return false;

    // Check all 6 neighbors
    const neighbors = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
      const neighborKey = this.coordToKey(nx, ny, nz);
      if (!this.grid.has(neighborKey)) {
        return true; // At least one neighbor doesn't exist
      }
    }

    return false;
  }

  /**
   * Expand from a specific cell
   * @param cellX - Cell X coordinate
   * @param cellY - Cell Y coordinate
   * @param cellZ - Cell Z coordinate
   * @param expansionX - Expansion amount in X direction
   * @param expansionY - Expansion amount in Y direction
   * @param expansionZ - Expansion amount in Z direction
   * @param options - Expansion options
   * @returns Promise resolving to the expanded sparse grid map
   */
  async expandFromCell(
    cellX: number,
    cellY: number,
    cellZ: number,
    expansionX: number,
    expansionY: number,
    expansionZ: number,
    options: ExpandOptions = {}
  ): Promise<Map<string, string>> {
    // Ensure models are loaded before expansion
    await this.ensureTilesetLoaded();

    // Initialize grid if it doesn't exist
    const isNewGrid = !this.grid || this.grid.size === 0;
    if (!this.grid) {
      console.log("No existing grid - creating new grid at specified location");
      this.grid = this.createEmptyMap();
    }

    if (isNewGrid) {
      this.debugUI?.showProgress("Creating new grid at cell...");
    } else {
      this.debugUI?.showProgress("Expanding from cell...");
    }
    this.debugUI?.setProgress(0);

    // Calculate expansion region centered on cell
    const halfExpX = Math.floor(expansionX / 2);
    const halfExpY = Math.floor(expansionY / 2);
    const halfExpZ = Math.floor(expansionZ / 2);

    const minX = cellX - halfExpX;
    const maxX = cellX + halfExpX + (expansionX % 2);
    const minY = cellY - halfExpY;
    const maxY = cellY + halfExpY + (expansionY % 2);
    const minZ = cellZ - halfExpZ;
    const maxZ = cellZ + halfExpZ + (expansionZ % 2);

    // Collect cells in the expansion region
    const newCells: Array<[number, number, number]> = []; // Cells that need to be collapsed
    const hiddenCells: Array<[number, number, number]> = []; // Cells that exist but aren't visible

    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        for (let z = minZ; z < maxZ; z++) {
          const key = this.coordToKey(x, y, z);
          if (!this.grid!.has(key)) {
            // This is a new cell that needs to be collapsed
            newCells.push([x, y, z]);
          } else if (!this.enabledCells.has(key)) {
            // This cell exists but is hidden - make it visible
            hiddenCells.push([x, y, z]);
          }
        }
      }
    }

    // If there are only hidden cells (no new cells), just enable them and re-render
    if (newCells.length === 0 && hiddenCells.length > 0) {
      console.log(`Making ${hiddenCells.length} hidden cells visible`);

      for (const [x, y, z] of hiddenCells) {
        const key = this.coordToKey(x, y, z);
        this.enabledCells.add(key);
      }

      // Re-render with updated enabled cells
      this.renderer.render(this.grid!, this.enabledCells);

      this.debugUI?.showProgress(`Made ${hiddenCells.length} cells visible`);
      this.debugUI?.setProgress(100);
      setTimeout(() => this.debugUI?.hideProgress(), 2000);

      return this.grid!;
    }

    // If there are no new cells and no hidden cells, nothing to do
    if (newCells.length === 0) {
      this.debugUI?.showProgress("No new cells to expand");
      this.debugUI?.setProgress(100);
      setTimeout(() => this.debugUI?.hideProgress(), 2000);
      return this.grid!;
    }

    // Include hidden cells in the cells to enable (make them visible too)
    const cellsToEnable = [...newCells, ...hiddenCells];

    console.log(
      `Expanding ${
        newCells.length
      } new cells from (${cellX}, ${cellY}, ${cellZ})${
        hiddenCells.length > 0
          ? ` + making ${hiddenCells.length} hidden cells visible`
          : ""
      }`
    );
    console.log(
      `Expansion region: X[${minX},${maxX}), Y[${minY},${maxY}), Z[${minZ},${maxZ})`
    );

    // Add padding buffer around expansion region for continuity
    const PADDING = 2;

    // Get grid bounds (will be initial dimensions if grid is empty)
    const bounds = this.getGridBounds();

    // If grid is empty, just use the expansion region with padding
    const isGridEmpty = this.grid.size === 0;
    const bufferMinX = isGridEmpty
      ? minX - PADDING
      : Math.min(bounds.minX, minX - PADDING);
    const bufferMaxX = isGridEmpty
      ? maxX + PADDING
      : Math.max(bounds.maxX + 1, maxX + PADDING);
    const bufferMinY = isGridEmpty
      ? minY - PADDING
      : Math.min(bounds.minY, minY - PADDING);
    const bufferMaxY = isGridEmpty
      ? maxY + PADDING
      : Math.max(bounds.maxY + 1, maxY + PADDING);
    const bufferMinZ = isGridEmpty
      ? minZ - PADDING
      : Math.min(bounds.minZ, minZ - PADDING);
    const bufferMaxZ = isGridEmpty
      ? maxZ + PADDING
      : Math.max(bounds.maxZ + 1, maxZ + PADDING);

    console.log(
      `Collapse buffer with padding: X[${bufferMinX},${bufferMaxX}), Y[${bufferMinY},${bufferMaxY}), Z[${bufferMinZ},${bufferMaxZ})`
    );

    // Use unified collapse method
    const result = await this.runCollapse(
      {
        minX: bufferMinX,
        maxX: bufferMaxX,
        minY: bufferMinY,
        maxY: bufferMaxY,
        minZ: bufferMinZ,
        maxZ: bufferMaxZ,
      },
      cellsToEnable, // Render both new cells and previously hidden cells
      this.seed,
      options
    );

    // Update grid with result
    this.grid = result;

    // Count what was added by tile type
    const tileCounts = new Map<string, number>();
    let actuallyAddedCount = 0;
    for (const [x, y, z] of newCells) {
      const key = this.coordToKey(x, y, z);
      const tileId = this.grid!.get(key);
      if (tileId) {
        tileCounts.set(tileId, (tileCounts.get(tileId) || 0) + 1);
        actuallyAddedCount++;
      }
    }

    console.log(
      `Expansion complete! Added ${actuallyAddedCount}/${newCells.length} cells to grid:`
    );
    for (const [tileId, count] of tileCounts.entries()) {
      console.log(`  ${tileId}: ${count} cells`);
    }

    // Update grid bounds
    this.updateGridBounds();

    // Update dimensions based on new bounds
    const newBounds = this.getGridBounds();
    this.width = newBounds.maxX - newBounds.minX + 1;
    this.height = newBounds.maxY - newBounds.minY + 1;
    this.depth = newBounds.maxZ - newBounds.minZ + 1;

    // Update debug grid to show new bounds
    if (this.debugGrid) {
      this.debugGrid.updateGrid(
        this.width,
        this.height,
        this.depth,
        newBounds.minX,
        newBounds.minY,
        newBounds.minZ
      );
    }

    const summary = Array.from(tileCounts.entries())
      .map(([id, count]) => `${id}(${count})`)
      .join(", ");

    let message: string;
    if (isNewGrid) {
      message = `Created ${actuallyAddedCount} cells: ${summary}`;
    } else if (hiddenCells.length > 0) {
      message = `Expanded ${actuallyAddedCount} cells + made ${hiddenCells.length} visible: ${summary}`;
    } else {
      message = `Expanded ${actuallyAddedCount} cells: ${summary}`;
    }

    this.debugUI?.showProgress(message);
    this.debugUI?.setProgress(100);
    setTimeout(() => this.debugUI?.hideProgress(), 4000);

    return this.grid!;
  }

  /**
   * Get preview of expansion region (which cells would be added)
   */
  getExpansionPreview(
    cellX: number,
    cellY: number,
    cellZ: number,
    expansionX: number,
    expansionY: number,
    expansionZ: number
  ): Array<[number, number, number]> {
    if (!this.grid) return [];

    const halfExpX = Math.floor(expansionX / 2);
    const halfExpY = Math.floor(expansionY / 2);
    const halfExpZ = Math.floor(expansionZ / 2);

    const minX = cellX - halfExpX;
    const maxX = cellX + halfExpX + (expansionX % 2);
    const minY = cellY - halfExpY;
    const maxY = cellY + halfExpY + (expansionY % 2);
    const minZ = cellZ - halfExpZ;
    const maxZ = cellZ + halfExpZ + (expansionZ % 2);

    const previewCells: Array<[number, number, number]> = [];
    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        for (let z = minZ; z < maxZ; z++) {
          const key = this.coordToKey(x, y, z);
          if (!this.grid.has(key)) {
            previewCells.push([x, y, z]);
          }
        }
      }
    }

    return previewCells;
  }

  /**
   * Delete cells from a specific cell
   * @param cellX - Cell X coordinate
   * @param cellY - Cell Y coordinate
   * @param cellZ - Cell Z coordinate
   * @param deletionX - Deletion amount in X direction
   * @param deletionY - Deletion amount in Y direction
   * @param deletionZ - Deletion amount in Z direction
   * @returns Promise resolving to the updated sparse grid map
   */
  async deleteFromCell(
    cellX: number,
    cellY: number,
    cellZ: number,
    deletionX: number,
    deletionY: number,
    deletionZ: number
  ): Promise<Map<string, string>> {
    if (!this.canExpand()) {
      throw new Error("Cannot delete: no existing grid");
    }

    // Calculate deletion region centered on cell
    const halfDelX = Math.floor(deletionX / 2);
    const halfDelY = Math.floor(deletionY / 2);
    const halfDelZ = Math.floor(deletionZ / 2);

    const minX = cellX - halfDelX;
    const maxX = cellX + halfDelX + (deletionX % 2);
    const minY = cellY - halfDelY;
    const maxY = cellY + halfDelY + (deletionY % 2);
    const minZ = cellZ - halfDelZ;
    const maxZ = cellZ + halfDelZ + (deletionZ % 2);

    // Remove cells from the region
    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        for (let z = minZ; z < maxZ; z++) {
          const key = this.coordToKey(x, y, z);
          this.grid!.delete(key);
          this.enabledCells.delete(key);
        }
      }
    }

    // Update grid bounds
    this.updateGridBounds();

    // Update debug grid
    if (this.debugGrid) {
      const newBounds = this.getGridBounds();
      this.debugGrid.updateGrid(
        newBounds.maxX - newBounds.minX + 1,
        newBounds.maxY - newBounds.minY + 1,
        newBounds.maxZ - newBounds.minZ + 1,
        newBounds.minX,
        newBounds.minY,
        newBounds.minZ
      );
    }

    // Re-render
    this.renderer.render(this.grid!, this.enabledCells);

    return this.grid!;
  }

  /**
   * Get the debug grid instance
   */
  getDebugGrid(): DebugGrid | null {
    return this.debugGrid;
  }

  /**
   * Get the renderer instance (may be null if collapse() hasn't been called yet)
   */
  getRenderer(): InstancedModelRenderer {
    return this.renderer;
  }

  /**
   * Set debug grid visibility
   */
  setDebugGridVisible(visible: boolean): void {
    if (this.debugGrid) this.debugGrid.setVisible(visible);
  }

  /**
   * Get the current cell size
   */
  getCellSize(): number {
    return this.cellSize;
  }

  /**
   * Update cell size for both renderer and debug grid
   */
  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    if (this.debugGrid) this.debugGrid.setCellSize(cellSize);

    if (this.renderer) {
      this.renderer.setCellSize(cellSize);

      // Re-render with new cell size if we have a grid
      if (this.grid) {
        this.renderer.render(this.grid, this.enabledCells);
      }
    }
  }

  /**
   * Update transform override for a specific tile type
   */
  updateTileTransform(tileId: string, transform: TileTransformOverride): void {
    this.renderer.updateTileTransform(tileId, transform);
  }

  /**
   * Clear all tile transform overrides
   */
  clearTileTransforms(): void {
    this.renderer.clearTransformOverrides();
  }

  /**
   * Get current grid dimensions
   */
  getDimensions(): { width: number; height: number; depth: number } {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
    };
  }

  /**
   * Get actual bounds of the sparse grid (min/max coordinates)
   */
  getGridBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    return { ...this.gridBounds };
  }

  /**
   * Ensure tileset models are loaded before operations that need them
   */
  private async ensureTilesetLoaded(): Promise<void> {
    if (!this.renderer.hasModelsLoaded()) {
      console.log("Models not loaded yet - loading tileset...");
      this.debugUI?.showProgress("Loading GLB models...");
      this.debugUI?.setProgress(0);
      const modelData = await this.loader.loadTileset(this.tiles);
      this.renderer.updateTileset(modelData);
      this.debugUI?.setProgress(10);
      console.log("Tileset loaded successfully");
    }
  }

  /**
   * Calculate and update grid bounds from current sparse map
   */
  private updateGridBounds(): void {
    if (!this.grid || this.grid.size === 0) {
      // Reset to initial dimensions
      this.gridBounds = {
        minX: 0,
        maxX: this.width - 1,
        minY: 0,
        maxY: this.height - 1,
        minZ: 0,
        maxZ: this.depth - 1,
      };
      return;
    }

    // Calculate actual bounds from existing cells
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const key of this.grid.keys()) {
      const [x, y, z] = this.keyToCoord(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    this.gridBounds = {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
      minZ: minZ === Infinity ? 0 : minZ,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
    };
  }

  /**
   * Register a callback to be invoked when the collapse/generation completes successfully
   * @param id - Unique identifier for this callback (used for unregistering)
   * @param callback - Function to call when generation completes
   * @returns The WFCGenerator instance for chaining
   */
  onComplete(id: string, callback: () => void): this {
    this.onCollapseComplete[id] = callback;
    return this;
  }

  /**
   * Unregister a completion callback
   * @param id - The identifier of the callback to remove
   * @returns The WFCGenerator instance for chaining
   */
  offComplete(id: string): this {
    delete this.onCollapseComplete[id];
    return this;
  }

  /**
   * Clear all registered completion callbacks
   */
  clearCompleteCallbacks(): void {
    this.onCollapseComplete = {};
  }

  /**
   * Get all registered callback IDs
   */
  getRegisteredCallbacks(): string[] {
    return Object.keys(this.onCollapseComplete);
  }

  /**
   * Get the number of workers in the pool
   */
  getWorkerCount(): number {
    return this.workerPool.getWorkerCount();
  }

  /**
   * Set the number of workers in the pool (recreates pool)
   */
  setWorkerCount(count: number): void {
    const maxWorkers = navigator.hardwareConcurrency || 4;
    const validCount = Math.min(Math.max(1, count), maxWorkers);

    console.log(
      `Recreating worker pool with ${validCount} workers (max: ${maxWorkers})`
    );

    // Terminate existing pool
    this.workerPool.terminate();

    // Create new pool with specified count
    this.workerPool = new WorkerPool(validCount);
  }

  /**
   * Terminate all workers and clean up
   */
  dispose(): void {
    this.workerPool.terminate();
    if (this.debugGrid) this.debugGrid.dispose();
    if (this.renderer) {
      this.renderer.clear();
    }
    this.clearCompleteCallbacks();
    this.reset();
  }

  /**
   * Trigger all registered completion callbacks
   */
  private triggerCompleteCallbacks(): void {
    Object.values(this.onCollapseComplete).forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in completion callback:", error);
      }
    });
  }

  /**
   * Format WFC error for display
   */
  static formatError(error: WFC3DError): string {
    const parts: string[] = [];

    parts.push(error.message);

    if (error.location) {
      parts.push(
        `at (${error.location.x}, ${error.location.y}, ${error.location.z})`
      );
    }

    if (error.progress !== undefined) {
      const percent = (error.progress * 100).toFixed(1);
      parts.push(`[${percent}% complete]`);
    }

    if (error.cellsCollapsed !== undefined && error.totalCells !== undefined) {
      parts.push(`(${error.cellsCollapsed}/${error.totalCells} cells)`);
    }

    if (error.details) {
      parts.push(`- ${error.details}`);
    }

    return parts.join(" ");
  }
}
