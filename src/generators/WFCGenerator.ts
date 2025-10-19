import * as THREE from "three";

import { WorkerPool } from "../utils/WorkerPool";
import { ModelTile3DConfig, WFC3DError } from "../wfc3d";
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

  // State for expansion
  private grid: string[][][] | null = null;
  private width: number = 8;
  private height: number = 1;
  private depth: number = 8;

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

    if (options.debug) {
      this.debugUI = new DebugUI(this);
      this.debugGrid = new DebugGrid(this.scene, this.cellSize);
    }

    // Create worker pool
    const workerCount =
      options.workerCount ?? (navigator.hardwareConcurrency || 4);
    this.workerPool = new WorkerPool(workerCount);
  }

  /**
   * Generate a new WFC grid
   * @param options - Generation options
   * @returns Promise resolving to the generated 3D grid
   */
  async generate(options: GenerateOptions = {}): Promise<string[][][]> {
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

        // Update debug grid
        if (this.debugGrid) this.debugGrid.updateGrid(width, height, depth);

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
  ): Promise<string[][][]> {
    // Initialize empty grid
    const internalGrid = this.createEmptyGrid(width, height, depth);

    return this.runWorkerTask(
      width,
      height,
      depth,
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
    newWidth: number,
    newHeight: number,
    newDepth: number,
    seed: number,
    options: ExpandOptions
  ): Promise<string[][][]> {
    // Initialize grid and copy existing data
    const internalGrid = this.createEmptyGrid(newWidth, newHeight, newDepth);
    if (this.grid) this.copyGridData(this.grid, internalGrid);

    return this.runWorkerTask(
      newWidth,
      newHeight,
      newDepth,
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
   * Create an empty 3D grid
   */
  private createEmptyGrid(
    width: number,
    height: number,
    depth: number
  ): string[][][] {
    return Array(width)
      .fill(null)
      .map(() =>
        Array(height)
          .fill(null)
          .map(() => Array(depth).fill(""))
      );
  }

  /**
   * Copy data from source grid to destination grid
   */
  private copyGridData(source: string[][][], destination: string[][][]): void {
    for (let x = 0; x < source.length; x++) {
      for (let y = 0; y < source[x].length; y++) {
        for (let z = 0; z < source[x][y].length; z++) {
          destination[x][y][z] = source[x][y][z];
        }
      }
    }
  }

  /**
   * Run a worker task with common message handling logic
   */
  private async runWorkerTask(
    width: number,
    height: number,
    depth: number,
    internalGrid: string[][][],
    options: GenerateOptions | ExpandOptions,
    workerMessage: any,
    errorMessage: string
  ): Promise<string[][][]> {
    // Create worker if not exists
    if (!this.worker) {
      this.worker = new Worker(new URL("../wfc.worker.ts", import.meta.url), {
        type: "module",
      });
    }

    return new Promise<string[][][]>((resolve, reject) => {
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

          // Update internal grid
          if (
            x >= 0 &&
            x < width &&
            y >= 0 &&
            y < height &&
            z >= 0 &&
            z < depth
          ) {
            internalGrid[x][y][z] = tileId;
          }

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
            resolve(message.data);
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
    grid: string[][][],
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

    for (let x = 0; x < grid.length; x++) {
      for (let y = 0; y < grid[x].length; y++) {
        for (let z = 0; z < grid[x][y].length; z++) {
          const tileId = grid[x][y][z];
          buffer.cellData.push({
            x,
            y,
            z,
            collapsed: true,
            tileId,
            possibleTiles: [tileId],
          });
        }
      }
    }

    return buffer;
  }

  /**
   * Expand the existing grid
   * @param newWidth - New grid width
   * @param newHeight - New grid height
   * @param newDepth - New grid depth
   * @param options - Expansion options
   * @returns Promise resolving to the expanded 3D grid
   */
  async expand(
    newWidth: number,
    newHeight: number,
    newDepth: number,
    options: ExpandOptions = {}
  ): Promise<string[][][]> {
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
      const result = await this.runExpansion(
        expansions,
        newWidth,
        newHeight,
        newDepth,
        seed,
        options
      );

      // Update stored state
      this.width = newWidth;
      this.height = newHeight;
      this.depth = newDepth;
      this.grid = result;

      // Update debug grid
      if (this.debugGrid)
        this.debugGrid.updateGrid(newWidth, newHeight, newDepth);

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
  ): Promise<string[][][]> {
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

    const shrunkGrid: string[][][] = [];

    // Copy only the cells within the new dimensions
    for (let x = 0; x < newWidth && x < this.grid!.length; x++) {
      shrunkGrid[x] = [];
      for (let y = 0; y < newHeight && y < this.grid![x].length; y++) {
        shrunkGrid[x][y] = [];
        for (let z = 0; z < newDepth && z < this.grid![x][y].length; z++) {
          shrunkGrid[x][y][z] = this.grid![x][y][z];
        }
      }
    }

    // Update stored state
    this.width = newWidth;
    this.height = newHeight;
    this.depth = newDepth;
    this.grid = shrunkGrid;

    // Update debug grid
    if (this.debugGrid)
      this.debugGrid.updateGrid(newWidth, newHeight, newDepth);

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
  getLastGrid(): string[][][] | null {
    return this.grid;
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
