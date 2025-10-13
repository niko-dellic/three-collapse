import * as THREE from "three";

/**
 * Helper types for mutually exclusive direction rules
 */
type UpRule = { up?: string[]; upEx?: never } | { up?: never; upEx?: string[] };
type DownRule =
  | { down?: string[]; downEx?: never }
  | { down?: never; downEx?: string[] };
type NorthRule =
  | { north?: string[]; northEx?: never }
  | { north?: never; northEx?: string[] };
type SouthRule =
  | { south?: string[]; southEx?: never }
  | { south?: never; southEx?: string[] };
type EastRule =
  | { east?: string[]; eastEx?: never }
  | { east?: never; eastEx?: string[] };
type WestRule =
  | { west?: string[]; westEx?: never }
  | { west?: never; westEx?: string[] };

/**
 * Adjacency rules with mutual exclusivity enforced per direction
 * You can specify EITHER inclusive (up) OR exclusive (upEx) for each direction, not both
 */
type AdjacencyRules = UpRule &
  DownRule &
  NorthRule &
  SouthRule &
  EastRule &
  WestRule;

/**
 * Base configuration for 3D tiles in Wave Function Collapse
 * Supports 6-way adjacency (up, down, north, south, east, west)
 *
 * For each direction, you can specify either:
 * - Inclusive rules (up, down, etc.): Only these tiles are allowed
 * - Exclusive rules (upEx, downEx, etc.): All tiles EXCEPT these are allowed
 *
 * Note: You CANNOT specify both inclusive and exclusive for the same direction.
 * TypeScript will show an error if you try to mix them.
 */
export interface BaseTile3DConfig {
  id: string;
  weight?: number;
  // Adjacency rules for each of the 6 directions
  // Direction indices: 0=up, 1=down, 2=north, 3=south, 4=east, 5=west
  adjacency?: AdjacencyRules;
}

/**
 * Voxel-based tile configuration
 */
export interface VoxelTile3DConfig extends BaseTile3DConfig {
  color?: string;
}

/**
 * Model-based tile configuration with GLB file support or custom geometry
 */
export interface ModelTile3DConfig extends BaseTile3DConfig {
  model: string | (() => THREE.Object3D); // path to GLB file OR function that returns a Three.js object
  material?: THREE.Material | THREE.Material[]; // optional material override for the loaded model
  position?: THREE.Vector3 | { x?: number; y?: number; z?: number }; // optional position offset from grid
  rotation?: THREE.Euler | { x?: number; y?: number; z?: number }; // optional rotation in radians
  scale?: THREE.Vector3 | number | { x?: number; y?: number; z?: number }; // optional scale (uniform or per-axis)
}

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use VoxelTile3DConfig instead
 */
export type WFCTile3DConfig = VoxelTile3DConfig;

export class WFCTile3D {
  id: string;
  weight: number;
  color?: string;
  filepath?: string;
  adjacency: Map<number, Set<string>>;
  adjacencyExclusive: Map<number, Set<string>>; // For exclusion rules

  // Direction constants
  static readonly UP = 0;
  static readonly DOWN = 1;
  static readonly NORTH = 2;
  static readonly SOUTH = 3;
  static readonly EAST = 4;
  static readonly WEST = 5;

  constructor(config: VoxelTile3DConfig | ModelTile3DConfig) {
    this.id = config.id;
    this.weight = config.weight ?? 1.0;

    // Handle voxel-specific properties
    if ("color" in config) {
      this.color = config.color ?? "#808080";
    }

    // Handle model-specific properties
    if ("model" in config) {
      if (typeof config.model === "string") this.filepath = config.model;
    }

    // Initialize adjacency maps
    this.adjacency = new Map();
    this.adjacencyExclusive = new Map();

    if (config.adjacency) {
      // Set adjacency for each direction if provided
      // TypeScript now enforces that only one of (direction, directionEx) can be specified
      // - Omitting a direction = no restrictions (all tiles allowed)
      // - Empty array [] = strict restriction (no tiles allowed for inclusive, all allowed for exclusive)

      // Check inclusive rules
      if (config.adjacency.up !== undefined) {
        this.adjacency.set(WFCTile3D.UP, new Set(config.adjacency.up));
      }
      if (config.adjacency.down !== undefined) {
        this.adjacency.set(WFCTile3D.DOWN, new Set(config.adjacency.down));
      }
      if (config.adjacency.north !== undefined) {
        this.adjacency.set(WFCTile3D.NORTH, new Set(config.adjacency.north));
      }
      if (config.adjacency.south !== undefined) {
        this.adjacency.set(WFCTile3D.SOUTH, new Set(config.adjacency.south));
      }
      if (config.adjacency.east !== undefined) {
        this.adjacency.set(WFCTile3D.EAST, new Set(config.adjacency.east));
      }
      if (config.adjacency.west !== undefined) {
        this.adjacency.set(WFCTile3D.WEST, new Set(config.adjacency.west));
      }

      // Check exclusive rules (TypeScript ensures these are mutually exclusive with inclusive)
      if (config.adjacency.upEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.UP,
          new Set(config.adjacency.upEx)
        );
      }
      if (config.adjacency.downEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.DOWN,
          new Set(config.adjacency.downEx)
        );
      }
      if (config.adjacency.northEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.NORTH,
          new Set(config.adjacency.northEx)
        );
      }
      if (config.adjacency.southEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.SOUTH,
          new Set(config.adjacency.southEx)
        );
      }
      if (config.adjacency.eastEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.EAST,
          new Set(config.adjacency.eastEx)
        );
      }
      if (config.adjacency.westEx !== undefined) {
        this.adjacencyExclusive.set(
          WFCTile3D.WEST,
          new Set(config.adjacency.westEx)
        );
      }
    }
  }

  /**
   * Check if this tile can be adjacent to another tile in a given direction
   * TypeScript ensures only one of (inclusive, exclusive) is set per direction
   */
  canBeAdjacentTo(tileId: string, direction: number): boolean {
    // Check inclusive rules
    const allowed = this.adjacency.get(direction);
    if (allowed !== undefined) {
      return allowed.has(tileId);
    }

    // Check exclusive rules (mutually exclusive with inclusive via TypeScript)
    const excluded = this.adjacencyExclusive.get(direction);
    if (excluded !== undefined) {
      return !excluded.has(tileId); // Inverted logic: return true if NOT in exclusion list
    }

    // No constraints means all tiles allowed
    return true;
  }

  /**
   * Get opposite direction
   */
  static getOppositeDirection(direction: number): number {
    switch (direction) {
      case WFCTile3D.UP:
        return WFCTile3D.DOWN;
      case WFCTile3D.DOWN:
        return WFCTile3D.UP;
      case WFCTile3D.NORTH:
        return WFCTile3D.SOUTH;
      case WFCTile3D.SOUTH:
        return WFCTile3D.NORTH;
      case WFCTile3D.EAST:
        return WFCTile3D.WEST;
      case WFCTile3D.WEST:
        return WFCTile3D.EAST;
      default:
        return direction;
    }
  }
}
