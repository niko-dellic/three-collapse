import * as THREE from "three";

import { WorkerPool } from "../utils/WorkerPool";
import {
  ModelTile3DConfig,
  WFC3DError,
  WFC3D,
  WFC3DBuffer,
  WFCTile3D,
} from "../wfc3d";
import { DebugUI, prepareTilesForWorker, validateTileset } from "../utils";
import { DebugGrid } from "../utils/DebugGrid";
import { InstancedModelRenderer } from "../renderers/InstancedModelRenderer";
import { GLBTileLoader } from "../loaders/GLBTileLoader";
import type {
  WFCGeneratorOptions,
  GenerateOptions,
  ExpandOptions,
  WorkerResponse,
  TileTransformOverride,
  SerializedBuffer,
} from "../types";

/**
 * Main WFC Generator class - handles all worker management, generation, expansion, retries, and rendering
 */
export class WFCGenerator {
  private tiles: ModelTile3DConfig[];
  private workerPool: WorkerPool;
  private worker: Worker | null = null;
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
        const result = await this.runGeneration(
          width,
          height,
          depth,
          seed + attempt - 1,
          options
        );

        // Store for expansion if enabled
        this.grid = result;

        // Update grid bounds
        this.updateGridBounds();

        // Update debug grid
        if (this.debugGrid) {
          const bounds = this.getGridBounds();
          this.debugGrid.updateGrid(
            width,
            height,
            depth,
            bounds.minX,
            bounds.minY,
            bounds.minZ
          );
        }

        // Render the final result
        this.renderer.render(result);

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
   * Run the actual generation process
   */
  private async runGeneration(
    width: number,
    height: number,
    depth: number,
    seed: number,
    options: GenerateOptions
  ): Promise<Map<string, string>> {
    // Initialize empty sparse grid
    const internalGrid = this.createEmptyMap();

    return this.runWorkerTask(
      internalGrid,
      options,
      {
        type: "generate",
        width,
        height,
        depth,
        tiles: prepareTilesForWorker(this.tiles),
        seed,
      },
      "Generation failed - contradiction occurred"
    );
  }

  /**
   * Run the actual expansion process
   */
  private async runExpansion(
    expansions: {
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      zMin: number;
      zMax: number;
    },
    seed: number,
    options: ExpandOptions
  ): Promise<Map<string, string>> {
    // Initialize sparse map and copy existing data
    const internalGrid = this.createEmptyMap();
    if (this.grid) this.copyMapData(this.grid, internalGrid);

    return this.runWorkerTask(
      internalGrid,
      options,
      {
        type: "expand",
        existingBuffer: this.serializeBuffer(
          this.grid!,
          this.width,
          this.height,
          this.depth
        ),
        expansions,
        tiles: prepareTilesForWorker(this.tiles),
        seed,
      },
      "Expansion failed - contradiction occurred"
    );
  }

  /**
   * Create an empty sparse map
   */
  private createEmptyMap(): Map<string, string> {
    return new Map();
  }

  /**
   * Copy data from source map to destination map
   */
  private copyMapData(
    source: Map<string, string>,
    destination: Map<string, string>
  ): void {
    for (const [key, value] of source.entries()) {
      destination.set(key, value);
    }
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
   * Run a worker task with common message handling logic
   */
  private async runWorkerTask(
    internalGrid: Map<string, string>,
    options: GenerateOptions | ExpandOptions,
    workerMessage: any,
    errorMessage: string
  ): Promise<Map<string, string>> {
    // Create worker if not exists
    if (!this.worker) {
      this.worker = new Worker(new URL("../wfc.worker.ts", import.meta.url), {
        type: "module",
      });
    }

    return new Promise<Map<string, string>>((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error("Worker not initialized"));
      }

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const message = e.data;

        if (message.type === "progress") {
          // Update internal UI
          this.debugUI?.setProgress(message.progress * 100);

          // Call user callback
          if (options.onProgress) {
            options.onProgress(message.progress);
          }
        } else if (message.type === "tile_update") {
          // Real-time tile update
          const { x, y, z, tileId } = message;

          // Update internal sparse grid
          const key = this.coordToKey(x, y, z);
          internalGrid.set(key, tileId);

          // Render tile in real-time
          if (this.renderer) {
            this.renderer.addTileInstance(tileId, x, y, z);
          }

          // Call user callback
          if (options.onTileUpdate) {
            options.onTileUpdate(x, y, z, tileId);
          }
        } else if (message.type === "complete") {
          if (message.success && message.data) {
            // Convert array response to sparse map
            const resultMap = this.arrayToMap(message.data);
            resolve(resultMap);
          } else {
            reject(new Error(errorMessage));
          }
        } else if (message.type === "error") {
          const error: any = new Error(message.message);
          if (message.error) {
            error.wfcError = message.error;
          }
          reject(error);
        }
      };

      this.worker.onerror = (error: ErrorEvent) => {
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send worker request
      this.worker.postMessage(workerMessage);
    });
  }

  /**
   * Serialize grid into buffer format for expansion
   */
  private serializeBuffer(
    grid: Map<string, string>,
    width: number,
    height: number,
    depth: number
  ): SerializedBuffer {
    const buffer = {
      width,
      height,
      depth,
      cellData: [] as Array<{
        x: number;
        y: number;
        z: number;
        collapsed: boolean;
        tileId: string;
        possibleTiles: string[];
      }>,
    };

    for (const [key, tileId] of grid.entries()) {
      const [x, y, z] = this.keyToCoord(key);
      buffer.cellData.push({
        x,
        y,
        z,
        collapsed: true,
        tileId,
        possibleTiles: [tileId],
      });
    }

    return buffer;
  }

  /**
   * Convert 3D array to sparse map
   */
  private arrayToMap(grid: string[][][]): Map<string, string> {
    const map = new Map<string, string>();

    for (let x = 0; x < grid.length; x++) {
      for (let y = 0; y < grid[x].length; y++) {
        for (let z = 0; z < grid[x][y].length; z++) {
          const tileId = grid[x][y][z];
          if (tileId) {
            const key = this.coordToKey(x, y, z);
            map.set(key, tileId);
          }
        }
      }
    }

    return map;
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

    // Calculate expansion amounts
    const expansions = {
      xMin: 0,
      xMax: Math.max(0, newWidth - this.width),
      yMin: 0,
      yMax: Math.max(0, newHeight - this.height),
      zMin: 0,
      zMax: Math.max(0, newDepth - this.depth),
    };

    // Check if we're actually expanding
    if (
      expansions.xMax === 0 &&
      expansions.yMax === 0 &&
      expansions.zMax === 0
    ) {
      // No expansion needed, just return current grid
      this.debugUI?.hideProgress();
      return this.grid!;
    }

    try {
      const result = await this.runExpansion(expansions, seed, options);

      // Update stored state
      this.width = newWidth;
      this.height = newHeight;
      this.depth = newDepth;
      this.grid = result;

      // Update grid bounds
      this.updateGridBounds();

      // Update debug grid
      if (this.debugGrid) {
        const bounds = this.getGridBounds();
        this.debugGrid.updateGrid(
          newWidth,
          newHeight,
          newDepth,
          bounds.minX,
          bounds.minY,
          bounds.minZ
        );
      }

      // Render the expanded result
      if (this.renderer) {
        this.renderer.render(result);

        // Show completion
        const stats = this.renderer.getStats();
        this.debugUI?.showProgress(
          `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`
        );
        this.debugUI?.setProgress(100);
        setTimeout(() => this.debugUI?.hideProgress(), 2000);
      }

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
    for (const [key, tileId] of this.grid!.entries()) {
      const [x, y, z] = this.keyToCoord(key);
      if (x < newWidth && y < newHeight && z < newDepth) {
        shrunkGrid.set(key, tileId);
      }
    }

    // Update stored state
    this.width = newWidth;
    this.height = newHeight;
    this.depth = newDepth;
    this.grid = shrunkGrid;

    // Update grid bounds
    this.updateGridBounds();

    // Update debug grid
    if (this.debugGrid) {
      const bounds = this.getGridBounds();
      this.debugGrid.updateGrid(
        newWidth,
        newHeight,
        newDepth,
        bounds.minX,
        bounds.minY,
        bounds.minZ
      );
    }

    this.renderer.render(shrunkGrid);

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
    _options: ExpandOptions = {}
  ): Promise<Map<string, string>> {
    if (!this.canExpand()) {
      throw new Error("Cannot expand: no existing grid");
    }

    this.debugUI?.showProgress("Expanding from cell...");
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

    // Collect new cells to add (skip existing cells)
    const newCells: Array<[number, number, number]> = [];
    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        for (let z = minZ; z < maxZ; z++) {
          const key = this.coordToKey(x, y, z);
          if (!this.grid!.has(key)) {
            // This is a new cell, add it
            newCells.push([x, y, z]);
            // Add to grid as empty for now (will be collapsed by WFC)
            this.grid!.set(key, "");
          }
          // If cell already exists, skip it (use as constraint)
        }
      }
    }

    if (newCells.length === 0) {
      this.debugUI?.showProgress("No new cells to expand");
      this.debugUI?.setProgress(100);
      setTimeout(() => this.debugUI?.hideProgress(), 2000);
      return this.grid!;
    }

    console.log(
      `Expanding ${newCells.length} new cells from (${cellX}, ${cellY}, ${cellZ})`
    );
    console.log(
      `Expansion region: X[${minX},${maxX}), Y[${minY},${maxY}), Z[${minZ},${maxZ})`
    );

    // Calculate bounds for the WFC buffer (includes existing + new cells)
    const bounds = this.getGridBounds();
    const bufferMinX = Math.min(bounds.minX, minX);
    const bufferMaxX = Math.max(bounds.maxX, maxX - 1);
    const bufferMinY = Math.min(bounds.minY, minY);
    const bufferMaxY = Math.max(bounds.maxY, maxY - 1);
    const bufferMinZ = Math.min(bounds.minZ, minZ);
    const bufferMaxZ = Math.max(bounds.maxZ, maxZ - 1);

    const bufferWidth = bufferMaxX - bufferMinX + 1;
    const bufferHeight = bufferMaxY - bufferMinY + 1;
    const bufferDepth = bufferMaxZ - bufferMinZ + 1;

    const totalBufferCells = bufferWidth * bufferHeight * bufferDepth;
    console.log(
      `Creating WFC buffer: ${bufferWidth}x${bufferHeight}x${bufferDepth} (${totalBufferCells} cells total)`
    );

    // Convert tiles to WFCTile3D instances
    const wfcTiles = this.tiles.map((config) => new WFCTile3D(config));

    // Create WFC buffer with all cells (existing + new)
    const buffer = new WFC3DBuffer(
      bufferWidth,
      bufferHeight,
      bufferDepth,
      wfcTiles
    );

    // Pre-collapse existing cells to constrain the WFC algorithm
    let constrainedCells = 0;
    for (const [key, tileId] of this.grid!.entries()) {
      if (!tileId) continue; // Skip empty cells
      const [worldX, worldY, worldZ] = this.keyToCoord(key);
      const bufferX = worldX - bufferMinX;
      const bufferY = worldY - bufferMinY;
      const bufferZ = worldZ - bufferMinZ;

      const cell = buffer.getCell(bufferX, bufferY, bufferZ);
      if (cell && !cell.collapsed) {
        cell.collapse(tileId);
        constrainedCells++;
      }
    }

    console.log(
      `Pre-collapsed ${constrainedCells} existing cells as constraints`
    );

    // Create a Set of new cell coordinates for fast lookup
    const newCellsSet = new Set(
      newCells.map(([x, y, z]) => this.coordToKey(x, y, z))
    );
    console.log(
      `Will only add ${newCellsSet.size} cells from expansion region`
    );

    // Run WFC on the buffer (will collapse all cells, but we only add expansion cells)
    this.debugUI?.showProgress("Running WFC on new cells...");
    const wfc = new WFC3D({
      width: bufferWidth,
      height: bufferHeight,
      depth: bufferDepth,
      tiles: wfcTiles,
      seed: this.seed,
    });
    wfc.buffer = buffer; // Use our pre-constrained buffer

    const success = await wfc.generate(
      (progress) => this.debugUI?.setProgress(progress * 100),
      (x, y, z, tileId) => {
        // Convert back to world coordinates
        const worldX = x + bufferMinX;
        const worldY = y + bufferMinY;
        const worldZ = z + bufferMinZ;
        const key = this.coordToKey(worldX, worldY, worldZ);

        // Only add cells that are in the expansion region
        if (newCellsSet.has(key)) {
          this.grid!.set(key, tileId);
        }
      }
    );

    if (!success) {
      const error = wfc.lastError;
      console.error("WFC failed during expansion:", error);
      this.debugUI?.showProgress("Expansion failed!");
      setTimeout(() => this.debugUI?.hideProgress(), 3000);
      throw new Error(
        `WFC expansion failed: ${error?.message || "Unknown error"}`
      );
    }

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

    // Update debug grid to show new bounds
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

    // Render the expanded grid
    this.renderer.render(this.grid!);

    const summary = Array.from(tileCounts.entries())
      .map(([id, count]) => `${id}(${count})`)
      .join(", ");

    this.debugUI?.showProgress(
      `Expanded ${actuallyAddedCount} cells: ${summary}`
    );
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
    this.renderer.render(this.grid!);

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
        this.renderer.render(this.grid);
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
   * Terminate all workers and clean up
   */
  dispose(): void {
    this.workerPool.terminate();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
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
