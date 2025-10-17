import * as THREE from "three";
import { WorkerPool } from "../utils/WorkerPool";
import { ModelTile3DConfig, WFC3DError } from "../wfc3d";
import { prepareTilesForWorker } from "../utils";
import { DebugGrid } from "../utils/DebugGrid";

/**
 * Configuration options for WFCGenerator
 */
export interface WFCGeneratorOptions {
  /** Number of workers to use (default: hardware concurrency) */
  workerCount?: number;
  /** Maximum number of retry attempts on failure (default: 3) */
  maxRetries?: number;
  /** Enable automatic expansion mode (default: false) */
  autoExpansion?: boolean;
  /** Random seed for generation */
  seed?: number;
  /** THREE.js scene for debug visualization */
  scene?: THREE.Scene;
  /** Cell size for debug grid (default: 1) */
  cellSize?: number;
}

/**
 * Options for generation calls
 */
export interface GenerateOptions {
  /** Override the seed for this generation */
  seed?: number;
  /** Callback for progress updates (0.0 to 1.0) */
  onProgress?: (progress: number) => void;
  /** Callback for individual tile updates */
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void;
}

/**
 * Options for expansion calls
 */
export interface ExpandOptions {
  /** Override the seed for this expansion */
  seed?: number;
  /** Callback for progress updates (0.0 to 1.0) */
  onProgress?: (progress: number) => void;
  /** Callback for individual tile updates */
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void;
}

/**
 * Worker message types
 */
interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface TileUpdateMessage {
  type: "tile_update";
  x: number;
  y: number;
  z: number;
  tileId: string;
}

interface CompleteMessage {
  type: "complete";
  success: boolean;
  data?: string[][][];
}

interface ErrorMessage {
  type: "error";
  message: string;
  error?: WFC3DError;
}

type WorkerResponse =
  | ProgressMessage
  | TileUpdateMessage
  | CompleteMessage
  | ErrorMessage;

/**
 * Main WFC Generator class - handles all worker management, generation, expansion, and retries
 */
export class WFCGenerator {
  private tiles: ModelTile3DConfig[];
  private workerPool: WorkerPool;
  private worker: Worker | null = null;
  private maxRetries: number;
  private currentSeed: number;
  private autoExpansion: boolean;
  private debugGrid: DebugGrid | null = null;
  private cellSize: number;

  // State for expansion
  private lastGeneratedGrid: string[][][] | null = null;
  private lastBuffer: any = null;
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private currentDepth: number = 0;

  /**
   * Create a new WFC Generator
   * @param tiles - Array of tile configurations
   * @param options - Generator options
   */
  constructor(tiles: ModelTile3DConfig[], options: WFCGeneratorOptions = {}) {
    this.tiles = tiles;
    this.maxRetries = options.maxRetries ?? 3;
    this.currentSeed = options.seed ?? Date.now();
    this.autoExpansion = options.autoExpansion ?? false;
    this.cellSize = options.cellSize ?? 1;

    // Create worker pool
    const workerCount =
      options.workerCount ?? (navigator.hardwareConcurrency || 4);
    this.workerPool = new WorkerPool(workerCount);

    // Create debug grid if scene is provided
    if (options.scene) {
      this.debugGrid = new DebugGrid(options.scene, this.cellSize);
    }
  }

  /**
   * Generate a new WFC grid
   * @param width - Grid width
   * @param height - Grid height
   * @param depth - Grid depth
   * @param options - Generation options
   * @returns Promise resolving to the generated 3D grid
   */
  async generate(
    width: number,
    height: number,
    depth: number,
    options: GenerateOptions = {}
  ): Promise<string[][][]> {
    const seed = options.seed ?? this.currentSeed;
    let attempt = 0;
    let lastError: Error | null = null;

    // Store dimensions for expansion
    this.currentWidth = width;
    this.currentHeight = height;
    this.currentDepth = depth;

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
        if (this.autoExpansion) {
          this.lastGeneratedGrid = result;
          this.lastBuffer = this.serializeBuffer(result, width, height, depth);
        }

        // Update debug grid
        if (this.debugGrid) {
          this.debugGrid.updateGrid(width, height, depth);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Generation error (attempt ${attempt}/${this.maxRetries}):`,
          error
        );

        // Check if error has WFC3DError details
        const wfcError = (error as any).wfcError as WFC3DError | undefined;
        if (wfcError) {
          console.error("WFC Error Details:", wfcError);
        }

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
    throw new Error(
      `Generation failed after ${this.maxRetries} attempts: ${
        lastError?.message || "Unknown error"
      }`
    );
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

    const seed = options.seed ?? this.currentSeed;

    // Calculate expansion amounts
    const expansions = {
      xMin: 0,
      xMax: Math.max(0, newWidth - this.currentWidth),
      yMin: 0,
      yMax: Math.max(0, newHeight - this.currentHeight),
      zMin: 0,
      zMax: Math.max(0, newDepth - this.currentDepth),
    };

    // Check if we're actually expanding
    if (
      expansions.xMax === 0 &&
      expansions.yMax === 0 &&
      expansions.zMax === 0
    ) {
      // No expansion needed, just return current grid
      return this.lastGeneratedGrid!;
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
      this.currentWidth = newWidth;
      this.currentHeight = newHeight;
      this.currentDepth = newDepth;
      this.lastGeneratedGrid = result;
      this.lastBuffer = this.serializeBuffer(
        result,
        newWidth,
        newHeight,
        newDepth
      );

      // Update debug grid
      if (this.debugGrid) {
        this.debugGrid.updateGrid(newWidth, newHeight, newDepth);
      }

      return result;
    } catch (error) {
      console.error("Expansion error:", error);
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
  shrink(newWidth: number, newHeight: number, newDepth: number): string[][][] {
    if (!this.canExpand()) {
      throw new Error("Cannot shrink: no existing grid");
    }

    const shrunkGrid: string[][][] = [];

    // Copy only the cells within the new dimensions
    for (let x = 0; x < newWidth && x < this.lastGeneratedGrid!.length; x++) {
      shrunkGrid[x] = [];
      for (
        let y = 0;
        y < newHeight && y < this.lastGeneratedGrid![x].length;
        y++
      ) {
        shrunkGrid[x][y] = [];
        for (
          let z = 0;
          z < newDepth && z < this.lastGeneratedGrid![x][y].length;
          z++
        ) {
          shrunkGrid[x][y][z] = this.lastGeneratedGrid![x][y][z];
        }
      }
    }

    // Update stored state
    this.currentWidth = newWidth;
    this.currentHeight = newHeight;
    this.currentDepth = newDepth;
    this.lastGeneratedGrid = shrunkGrid;
    this.lastBuffer = this.serializeBuffer(
      shrunkGrid,
      newWidth,
      newHeight,
      newDepth
    );

    // Update debug grid
    if (this.debugGrid) {
      this.debugGrid.updateGrid(newWidth, newHeight, newDepth);
    }

    return shrunkGrid;
  }

  /**
   * Check if expansion is possible
   */
  canExpand(): boolean {
    return this.lastGeneratedGrid !== null && this.lastBuffer !== null;
  }

  /**
   * Reset the generator state (clears expansion data)
   */
  reset(): void {
    this.lastGeneratedGrid = null;
    this.lastBuffer = null;
    this.currentWidth = 0;
    this.currentHeight = 0;
    this.currentDepth = 0;
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
    this.currentSeed = seed;
  }

  /**
   * Get the current seed
   */
  getSeed(): number {
    return this.currentSeed;
  }

  /**
   * Get the last generated grid
   */
  getLastGrid(): string[][][] | null {
    return this.lastGeneratedGrid;
  }

  /**
   * Get the debug grid instance
   */
  getDebugGrid(): DebugGrid | null {
    return this.debugGrid;
  }

  /**
   * Set debug grid visibility
   */
  setDebugGridVisible(visible: boolean): void {
    if (this.debugGrid) {
      this.debugGrid.setVisible(visible);
    }
  }

  /**
   * Update cell size for the debug grid
   */
  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    if (this.debugGrid) {
      this.debugGrid.setCellSize(cellSize);
    }
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
    if (this.debugGrid) {
      this.debugGrid.dispose();
      this.debugGrid = null;
    }
    this.reset();
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
    // Create worker if not exists
    if (!this.worker) {
      this.worker = new Worker(new URL("../wfc.worker.ts", import.meta.url), {
        type: "module",
      });
    }

    // Initialize internal grid for real-time updates
    const internalGrid: string[][][] = Array(width)
      .fill(null)
      .map(() =>
        Array(height)
          .fill(null)
          .map(() => Array(depth).fill(""))
      );

    return new Promise<string[][][]>((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error("Worker not initialized"));
      }

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const message = e.data;

        if (message.type === "progress") {
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

          // Call user callback
          if (options.onTileUpdate) {
            options.onTileUpdate(x, y, z, tileId);
          }
        } else if (message.type === "complete") {
          if (message.success && message.data) {
            resolve(message.data);
          } else {
            reject(new Error("Generation failed - contradiction occurred"));
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

      // Send generation request
      this.worker.postMessage({
        type: "generate",
        width,
        height,
        depth,
        tiles: prepareTilesForWorker(this.tiles),
        seed,
      });
    });
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
    // Create worker if not exists
    if (!this.worker) {
      this.worker = new Worker(new URL("../wfc.worker.ts", import.meta.url), {
        type: "module",
      });
    }

    // Initialize internal grid with existing data
    const internalGrid: string[][][] = Array(newWidth)
      .fill(null)
      .map(() =>
        Array(newHeight)
          .fill(null)
          .map(() => Array(newDepth).fill(""))
      );

    // Copy existing grid data
    if (this.lastGeneratedGrid) {
      for (let x = 0; x < this.lastGeneratedGrid.length; x++) {
        for (let y = 0; y < this.lastGeneratedGrid[x].length; y++) {
          for (let z = 0; z < this.lastGeneratedGrid[x][y].length; z++) {
            internalGrid[x][y][z] = this.lastGeneratedGrid[x][y][z];
          }
        }
      }
    }

    return new Promise<string[][][]>((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error("Worker not initialized"));
      }

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const message = e.data;

        if (message.type === "progress") {
          if (options.onProgress) {
            options.onProgress(message.progress);
          }
        } else if (message.type === "tile_update") {
          // Real-time tile update during expansion
          const { x, y, z, tileId } = message;

          // Update internal grid
          if (
            x >= 0 &&
            x < newWidth &&
            y >= 0 &&
            y < newHeight &&
            z >= 0 &&
            z < newDepth
          ) {
            internalGrid[x][y][z] = tileId;
          }

          // Call user callback
          if (options.onTileUpdate) {
            options.onTileUpdate(x, y, z, tileId);
          }
        } else if (message.type === "complete") {
          if (message.success && message.data) {
            resolve(message.data);
          } else {
            reject(new Error("Expansion failed - contradiction occurred"));
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

      // Send expansion request
      this.worker.postMessage({
        type: "expand",
        existingBuffer: this.lastBuffer,
        expansions,
        tiles: prepareTilesForWorker(this.tiles),
        seed,
      });
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
  ): any {
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
