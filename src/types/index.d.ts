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
  /** Callback for completion */
  onComplete?: () => void;
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
export interface ProgressMessage {
  type: "progress";
  progress: number;
}

export interface TileUpdateMessage {
  type: "tile_update";
  x: number;
  y: number;
  z: number;
  tileId: string;
}

export interface CompleteMessage {
  type: "complete";
  success: boolean;
  data?: string[][][];
}

export interface ErrorMessage {
  type: "error";
  message: string;
  error?: WFC3DError;
}

export type WorkerResponse =
  | ProgressMessage
  | TileUpdateMessage
  | CompleteMessage
  | ErrorMessage;
