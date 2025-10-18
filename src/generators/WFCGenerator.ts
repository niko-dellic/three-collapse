import * as THREE from "three";
import { WorkerPool } from "../utils/WorkerPool";
import { ModelTile3DConfig, WFC3DError } from "../wfc3d";
import {
  DebugUI,
  prepareTilesForWorker,
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
  validateTileset,
  type DemoUIElements,
} from "../utils";
import { DebugGrid } from "../utils/DebugGrid";
import {
  InstancedModelRenderer,
  type TileTransformOverride,
} from "../renderers/InstancedModelRenderer";
import { GLBTileLoader } from "../loaders/GLBTileLoader";

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
  /** THREE.js scene for rendering and debug visualization (required) */
  scene: THREE.Scene;
  /** Cell size for rendering and debug grid (default: 1) */
  cellSize?: number;
  /** Initial grid width (default: 10) */
  width?: number;
  /** Initial grid height (default: 8) */
  height?: number;
  /** Initial grid depth (default: 10) */
  depth?: number;
  /** Debug mode (default: false) */
  debug?: boolean;
}

/**
 * Options for collapse calls
 */
export interface CollapseOptions {
  /** Optional GLBTileLoader instance (will create one if not provided) */
  loader?: GLBTileLoader;
  /** Offset for centering the grid */
  offset?: { x: number; y: number; z: number };
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
 * Main WFC Generator class - handles all worker management, generation, expansion, retries, and rendering
 */
export class WFCGenerator {
  private tiles: ModelTile3DConfig[];
  private workerPool: WorkerPool;
  private worker: Worker | null = null;
  private maxRetries: number;
  private currentSeed: number;
  private autoExpansion: boolean;
  private debugGrid: DebugGrid;
  private renderer: InstancedModelRenderer | null = null;
  private scene: THREE.Scene;
  private cellSize: number;

  // State for expansion
  private lastGeneratedGrid: string[][][] | null = null;
  private lastBuffer: any = null;
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private currentDepth: number = 0;

  // Collapse options for re-collapsing from UI
  private lastLoader: GLBTileLoader | null = null;
  private lastOffset: { x: number; y: number; z: number } | null = null;

  // ui
  private debugUI: DebugUI | null = null;

  /**
   * Create a new WFC Generator
   * @param tiles - Array of tile configurations
   * @param options - Generator options
   */
  constructor(tiles: ModelTile3DConfig[], options: WFCGeneratorOptions) {
    this.tiles = tiles;
    this.scene = options.scene;
    this.maxRetries = options.maxRetries ?? 3;
    this.currentSeed = options.seed ?? Date.now();
    this.autoExpansion = options.autoExpansion ?? false;
    this.cellSize = options.cellSize ?? 1;

    // Initialize default dimensions
    this.currentWidth = options.width ?? 10;
    this.currentHeight = options.height ?? 8;
    this.currentDepth = options.depth ?? 10;

    // Validate tileset
    console.log("Validating tileset...");
    const validation = validateTileset(this.tiles);
    if (!validation.valid) {
      console.warn("⚠️ Tileset validation found issues:");
      for (const issue of validation.issues) {
        const prefix = issue.severity === "error" ? "❌" : "⚠️";
        console.warn(`${prefix} ${issue.message}`);
      }
    }
    if (validation.suggestions.length > 0) {
      console.log("💡 Suggestions:");
      for (const suggestion of validation.suggestions) {
        console.log(`  - ${suggestion}`);
      }
    }
    if (validation.valid) {
      console.log("✅ Tileset validation passed!");
    }

    if (options.debug) this.debugUI = new DebugUI(this);

    // Create worker pool
    const workerCount =
      options.workerCount ?? (navigator.hardwareConcurrency || 4);
    this.workerPool = new WorkerPool(workerCount);

    // Create debug grid
    this.debugGrid = new DebugGrid(this.scene, this.cellSize);
  }

  hideDebugUI(): void {
    if (this.debugUI) this.debugUI.gui.hide();
  }
  showDebugUI(): void {
    if (this.debugUI) this.debugUI.gui.show();
    else this.debugUI = new DebugUI(this);
  }

  /**
   * Get UI elements for internal progress updates
   */
  private getUI(): DemoUIElements | null {
    if (!this.debugUI) return null;
    return {
      gui: this.debugUI.gui,
      gridFolder: this.debugUI.gridFolder,
      progressElement: this.debugUI.progressElement,
      tilesetEditor: this.debugUI.tilesetEditor,
    };
  }

  /**
   * Collapse (solve) the WFC - loads models and generates the grid
   * @param options - Collapse options including grid dimensions
   * @returns Promise resolving to the generated 3D grid
   */
  async collapse(options: CollapseOptions): Promise<string[][][]> {
    const ui = this.getUI();

    // Use provided options or fall back to stored values
    const loader = options.loader || this.lastLoader || new GLBTileLoader();
    const offset = options.offset || this.lastOffset;

    // Store options for future re-collapsing from UI
    this.lastLoader = loader;
    if (offset) this.lastOffset = offset;

    // Clear existing renderer if re-generating
    if (this.renderer) {
      this.renderer.clear();
    }

    // Load models if renderer doesn't exist yet
    if (!this.renderer) {
      showProgress(ui, "Loading GLB models...");
      setProgress(ui, 0);

      const modelData = await loader.loadTileset(this.tiles);

      setProgress(ui, 10);

      // Create renderer with loaded models
      this.renderer = new InstancedModelRenderer(
        this.scene,
        modelData,
        this.cellSize
      );

      // Set offset if provided
      if (offset) {
        this.renderer.setOffset(offset.x, offset.y, offset.z);
      }
    } else if (offset && this.renderer) {
      // Update offset if provided and renderer exists
      this.renderer.setOffset(offset.x, offset.y, offset.z);
    }

    // Generate the grid
    const { width, height, depth } = this.getDimensions();
    return await this.generate(width, height, depth);
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
    const ui = this.getUI();
    const seed = options.seed ?? this.currentSeed;
    let attempt = 0;
    let lastError: Error | null = null;

    // Show progress
    showProgress(ui, "Running WFC algorithm...");
    setProgress(ui, 0);

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
        this.debugGrid.updateGrid(width, height, depth);

        // Render the final result
        if (this.renderer) {
          this.renderer.render(result);

          // Show completion
          const stats = this.renderer.getStats();
          showProgress(
            ui,
            `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`
          );
          setProgress(ui, 100);
          setTimeout(() => hideProgress(ui), 2000);
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
    const errorMessage = `Generation failed after ${
      this.maxRetries
    } attempts: ${lastError?.message || "Unknown error"}`;

    showProgress(ui, `Failed: ${lastError?.message || "Unknown error"}`);
    setProgress(ui, 0);
    setProgressColor(ui, "#ef4444");
    setTimeout(() => {
      setProgressColor(ui, "var(--focus-color)");
      hideProgress(ui);
    }, 3000);

    throw new Error(errorMessage);
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
    const ui = this.getUI();

    if (!this.canExpand()) {
      throw new Error(
        "Cannot expand: no existing grid. Generate a grid first with autoExpansion enabled."
      );
    }

    const seed = options.seed ?? this.currentSeed;

    // Show progress
    showProgress(ui, "Expanding grid...");
    setProgress(ui, 0);

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
      hideProgress(ui);
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
      this.debugGrid.updateGrid(newWidth, newHeight, newDepth);

      // Render the expanded result
      if (this.renderer) {
        this.renderer.render(result);

        // Show completion
        const stats = this.renderer.getStats();
        showProgress(
          ui,
          `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`
        );
        setProgress(ui, 100);
        setTimeout(() => hideProgress(ui), 2000);
      }

      return result;
    } catch (error) {
      console.error("Expansion error:", error);

      showProgress(ui, `Failed: ${(error as Error).message}`);
      setProgress(ui, 0);
      setProgressColor(ui, "#ef4444");
      setTimeout(() => {
        setProgressColor(ui, "var(--focus-color)");
        hideProgress(ui);
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
      newWidth > this.currentWidth ||
      newHeight > this.currentHeight ||
      newDepth > this.currentDepth
    ) {
      throw new Error(
        "Cannot shrink to larger dimensions. Use expand() instead."
      );
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
    this.debugGrid.updateGrid(newWidth, newHeight, newDepth);

    // Render the shrunk result
    if (this.renderer) {
      this.renderer.render(shrunkGrid);
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
  getDebugGrid(): DebugGrid {
    return this.debugGrid;
  }

  /**
   * Get the renderer instance (may be null if collapse() hasn't been called yet)
   */
  getRenderer(): InstancedModelRenderer | null {
    return this.renderer;
  }

  /**
   * Set debug grid visibility
   */
  setDebugGridVisible(visible: boolean): void {
    this.debugGrid.setVisible(visible);
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
    this.debugGrid.setCellSize(cellSize);

    if (this.renderer) {
      this.renderer.setCellSize(cellSize);

      // Re-render with new cell size if we have a grid
      if (this.lastGeneratedGrid) {
        this.renderer.render(this.lastGeneratedGrid);
      }
    }
  }

  /**
   * Update transform override for a specific tile type
   */
  updateTileTransform(tileId: string, transform: TileTransformOverride): void {
    if (this.renderer) {
      this.renderer.updateTileTransform(tileId, transform);
    }
  }

  /**
   * Clear all tile transform overrides
   */
  clearTileTransforms(): void {
    if (this.renderer) {
      this.renderer.clearTransformOverrides();
    }
  }

  /**
   * Get current grid dimensions
   */
  getDimensions(): { width: number; height: number; depth: number } {
    return {
      width: this.currentWidth,
      height: this.currentHeight,
      depth: this.currentDepth,
    };
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
    this.debugGrid.dispose();
    if (this.renderer) {
      this.renderer.clear();
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
          // Update internal UI
          const ui = this.getUI();
          setProgress(ui, message.progress * 100);

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
          // Update internal UI
          const ui = this.getUI();
          setProgress(ui, message.progress * 100);

          // Call user callback
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
