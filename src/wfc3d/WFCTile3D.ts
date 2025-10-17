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
type AllRule =
  | { all?: string[]; allEx?: never }
  | { all?: never; allEx?: string[] };

/**
 * Adjacency rules with mutual exclusivity enforced per direction
 *
 * Base Rules (applied to all faces):
 * - `all`: Include these tiles on all faces (can be overridden per face)
 * - `allEx`: Exclude these tiles from all faces (can be overridden per face)
 *
 * Per-Face Rules (override base rules):
 * - `up/down/north/south/east/west`: Inclusive rules for specific faces
 * - `upEx/downEx/northEx/southEx/eastEx/westEx`: Exclusive rules for specific faces
 *
 * You can specify EITHER inclusive OR exclusive for each direction, not both.
 * Individual face rules override the base `all` or `allEx` rule.
 */
type AdjacencyRules = AllRule &
  UpRule &
  DownRule &
  NorthRule &
  SouthRule &
  EastRule &
  WestRule;

/**
 * Base configuration for 3D tiles in Wave Function Collapse
 * Supports 6-way adjacency (up, down, north, south, east, west)
 *
 * Adjacency Rules:
 * - Base rules: `all` or `allEx` apply to all faces
 * - Per-face rules: `up`, `down`, `north`, `south`, `east`, `west` (or their `Ex` variants)
 * - Per-face rules override base rules for that specific face
 *
 * Rule Types:
 * - Inclusive (all, up, down, etc.): Only these tiles are allowed
 * - Exclusive (allEx, upEx, downEx, etc.): All tiles EXCEPT these are allowed
 *
 * Note: You CANNOT specify both inclusive and exclusive for the same direction.
 * TypeScript will show an error if you try to mix them.
 *
 * Example:
 * ```typescript
 * {
 *   id: "grass",
 *   adjacency: {
 *     all: ["grass", "dirt"],  // Base rule for all faces
 *     up: ["air"],              // Override for up face
 *     down: ["dirt"]            // Override for down face
 *   }
 * }
 * ```
 */
export interface BaseTile3DConfig {
  id: string;
  weight?: number;
  // Adjacency rules for each of the 6 directions
  // Direction indices: 0=up, 1=down, 2=north, 3=south, 4=east, 5=west
  adjacency?: AdjacencyRules;
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

  constructor(config: ModelTile3DConfig) {
    this.id = config.id;
    this.weight = config.weight ?? 1.0;

    // Handle model-specific properties
    if ("model" in config)
      if (typeof config.model === "string") this.filepath = config.model;

    // Initialize adjacency maps
    this.adjacency = new Map();
    this.adjacencyExclusive = new Map();

    if (config.adjacency) {
      // Step 1: Apply base rules to all directions (if specified)
      // These act as defaults that can be overridden per-face
      const allDirections = [
        WFCTile3D.UP,
        WFCTile3D.DOWN,
        WFCTile3D.NORTH,
        WFCTile3D.SOUTH,
        WFCTile3D.EAST,
        WFCTile3D.WEST,
      ];

      if (config.adjacency.all !== undefined) {
        // Apply inclusive base rule to all directions
        const baseSet = new Set(config.adjacency.all);
        for (const dir of allDirections) {
          this.adjacency.set(dir, new Set(baseSet));
        }
      }

      if (config.adjacency.allEx !== undefined) {
        // Apply exclusive base rule to all directions
        const baseExSet = new Set(config.adjacency.allEx);
        for (const dir of allDirections) {
          this.adjacencyExclusive.set(dir, new Set(baseExSet));
        }
      }

      // Step 2: Override with per-face inclusive rules
      // These override the base rule for specific directions
      if (config.adjacency.up !== undefined) {
        // Clear any base rule for this direction first
        this.adjacencyExclusive.delete(WFCTile3D.UP);
        this.adjacency.set(WFCTile3D.UP, new Set(config.adjacency.up));
      }
      if (config.adjacency.down !== undefined) {
        this.adjacencyExclusive.delete(WFCTile3D.DOWN);
        this.adjacency.set(WFCTile3D.DOWN, new Set(config.adjacency.down));
      }
      if (config.adjacency.north !== undefined) {
        this.adjacencyExclusive.delete(WFCTile3D.NORTH);
        this.adjacency.set(WFCTile3D.NORTH, new Set(config.adjacency.north));
      }
      if (config.adjacency.south !== undefined) {
        this.adjacencyExclusive.delete(WFCTile3D.SOUTH);
        this.adjacency.set(WFCTile3D.SOUTH, new Set(config.adjacency.south));
      }
      if (config.adjacency.east !== undefined) {
        this.adjacencyExclusive.delete(WFCTile3D.EAST);
        this.adjacency.set(WFCTile3D.EAST, new Set(config.adjacency.east));
      }
      if (config.adjacency.west !== undefined) {
        this.adjacencyExclusive.delete(WFCTile3D.WEST);
        this.adjacency.set(WFCTile3D.WEST, new Set(config.adjacency.west));
      }

      // Step 3: Override with per-face exclusive rules
      // These override the base rule for specific directions
      if (config.adjacency.upEx !== undefined) {
        // Clear any base rule for this direction first
        this.adjacency.delete(WFCTile3D.UP);
        this.adjacencyExclusive.set(
          WFCTile3D.UP,
          new Set(config.adjacency.upEx)
        );
      }
      if (config.adjacency.downEx !== undefined) {
        this.adjacency.delete(WFCTile3D.DOWN);
        this.adjacencyExclusive.set(
          WFCTile3D.DOWN,
          new Set(config.adjacency.downEx)
        );
      }
      if (config.adjacency.northEx !== undefined) {
        this.adjacency.delete(WFCTile3D.NORTH);
        this.adjacencyExclusive.set(
          WFCTile3D.NORTH,
          new Set(config.adjacency.northEx)
        );
      }
      if (config.adjacency.southEx !== undefined) {
        this.adjacency.delete(WFCTile3D.SOUTH);
        this.adjacencyExclusive.set(
          WFCTile3D.SOUTH,
          new Set(config.adjacency.southEx)
        );
      }
      if (config.adjacency.eastEx !== undefined) {
        this.adjacency.delete(WFCTile3D.EAST);
        this.adjacencyExclusive.set(
          WFCTile3D.EAST,
          new Set(config.adjacency.eastEx)
        );
      }
      if (config.adjacency.westEx !== undefined) {
        this.adjacency.delete(WFCTile3D.WEST);
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
