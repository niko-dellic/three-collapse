import * as THREE from "three";
import type {
  ConnectorData,
  TileConnectors,
  DirectionalExclusion,
} from "../types";

/**
 * Base configuration for 3D tiles in Wave Function Collapse
 * Uses connector-based adjacency following the Marian42 WFC blog approach
 *
 * Connectors:
 * - Each face has a connector with groupId, symmetry (horizontal faces), or rotation (vertical faces)
 * - Tiles can connect if their facing connectors have matching groupIds and compatible symmetry/rotation
 *
 * Exclusions:
 * - Directional exclusions prevent specific tile pairs from being adjacent
 * - Applied bidirectionally during propagation
 *
 * Example:
 * ```typescript
 * {
 *   id: "floor",
 *   weight: 1,
 *   connectors: {
 *     up: { groupId: "floor_top", symmetry: "symmetric" },
 *     down: { groupId: "solid", rotation: "invariant" },
 *     north: { groupId: "floor_side", symmetry: "symmetric" },
 *     south: { groupId: "floor_side", symmetry: "symmetric" },
 *     east: { groupId: "floor_side", symmetry: "symmetric" },
 *     west: { groupId: "floor_side", symmetry: "symmetric" }
 *   },
 *   exclusions: [
 *     { targetTileId: "wall", direction: "up" }
 *   ]
 * }
 * ```
 */
/**
 * Legacy adjacency rules (for backward compatibility with AdjacencyBuilderUI)
 */
type LegacyAdjacencyRules = {
  up?: string[];
  down?: string[];
  north?: string[];
  south?: string[];
  east?: string[];
  west?: string[];
  upEx?: string[];
  downEx?: string[];
  northEx?: string[];
  southEx?: string[];
  eastEx?: string[];
  westEx?: string[];
  all?: string[];
  allEx?: string[];
};

export interface BaseTile3DConfig {
  id: string;
  weight?: number;
  connectors?: TileConnectors; // Optional for backward compat with legacy tools
  exclusions?: DirectionalExclusion[];
  // Legacy support for old adjacency builder (not used by WFC3D)
  adjacency?: LegacyAdjacencyRules;
}

/**
 * Model-based tile configuration with GLB file support or custom geometry
 */
export interface ModelTile3DConfig extends BaseTile3DConfig {
  model: string | (() => THREE.Object3D) | THREE.Object3D; // path to GLB file OR function that returns a Three.js object OR Three.js object
  material?: THREE.Material | THREE.Material[]; // optional material override for the loaded model
  position?: THREE.Vector3 | { x?: number; y?: number; z?: number }; // optional position offset from grid
  rotation?: THREE.Euler | { x?: number; y?: number; z?: number }; // optional rotation in radians
  scale?: THREE.Vector3 | number | { x?: number; y?: number; z?: number }; // optional scale (uniform or per-axis)
}

export class WFCTile3D {
  id: string;
  weight: number;
  connectors: TileConnectors;
  exclusions: DirectionalExclusion[];
  filepath?: string;

  // Direction constants
  static readonly UP = 0;
  static readonly DOWN = 1;
  static readonly NORTH = 2;
  static readonly SOUTH = 3;
  static readonly EAST = 4;
  static readonly WEST = 5;

  // Direction name mapping
  static readonly DIRECTION_NAMES = [
    "up",
    "down",
    "north",
    "south",
    "east",
    "west",
  ] as const;

  constructor(config: ModelTile3DConfig) {
    this.id = config.id;
    this.weight = config.weight ?? 1.0;

    if (!config.connectors) {
      throw new Error(
        `Tile '${config.id}' has no connectors. The connector-based WFC system requires all tiles to have connectors defined. Use ConnectorBuilderUI to create connector-based tilesets.`
      );
    }

    this.connectors = config.connectors;
    this.exclusions = config.exclusions || [];

    // Handle model-specific properties
    if ("model" in config && typeof config.model === "string") {
      this.filepath = config.model;
    }
  }

  /**
   * Get connector for a specific direction
   */
  getConnector(direction: number): ConnectorData {
    const dirName = WFCTile3D.DIRECTION_NAMES[
      direction
    ] as keyof TileConnectors;
    return this.connectors[dirName];
  }

  /**
   * Check if this tile's connector is compatible with another tile's connector
   */
  isConnectorCompatible(
    myDirection: number,
    otherTile: WFCTile3D,
    otherDirection: number
  ): boolean {
    const myConnector = this.getConnector(myDirection);
    const otherConnector = otherTile.getConnector(otherDirection);

    // Must have same group ID
    if (myConnector.groupId !== otherConnector.groupId) {
      return false;
    }

    const isVertical =
      myDirection === WFCTile3D.UP || myDirection === WFCTile3D.DOWN;

    if (isVertical) {
      // Vertical faces (up/down): check rotation
      const rotA = myConnector.rotation;
      const rotB = otherConnector.rotation;

      return rotA === "invariant" || rotB === "invariant" || rotA === rotB;
    } else {
      // Horizontal faces (north/south/east/west): check symmetry
      const symA = myConnector.symmetry!;
      const symB = otherConnector.symmetry!;

      return (
        symA === "symmetric" ||
        symB === "symmetric" ||
        (symA === "flipped" && symB === "not-flipped") ||
        (symA === "not-flipped" && symB === "flipped")
      );
    }
  }

  /**
   * Check if this tile can be adjacent to another tile in a given direction
   * considering both connector compatibility and exclusions
   */
  canBeAdjacentTo(otherTile: WFCTile3D, direction: number): boolean {
    const oppositeDir = WFCTile3D.getOppositeDirection(direction);

    // Check connector compatibility
    if (!this.isConnectorCompatible(direction, otherTile, oppositeDir)) {
      return false;
    }

    // Check exclusions (bidirectional)
    const hasExclusion = this.exclusions.some(
      (ex) =>
        ex.targetTileId === otherTile.id &&
        ex.direction === WFCTile3D.DIRECTION_NAMES[direction]
    );

    const hasReverseExclusion = otherTile.exclusions.some(
      (ex) =>
        ex.targetTileId === this.id &&
        ex.direction === WFCTile3D.DIRECTION_NAMES[oppositeDir]
    );

    return !hasExclusion && !hasReverseExclusion;
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
