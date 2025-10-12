/**
 * Represents a 3D tile for Wave Function Collapse
 * Supports 6-way adjacency (up, down, north, south, east, west)
 */
export interface WFCTile3DConfig {
  id: string;
  weight?: number;
  color?: string;
  // Adjacency rules for each of the 6 directions
  // Direction indices: 0=up, 1=down, 2=north, 3=south, 4=east, 5=west
  adjacency?: {
    up?: string[];
    down?: string[];
    north?: string[];
    south?: string[];
    east?: string[];
    west?: string[];
  };
}

export class WFCTile3D {
  id: string;
  weight: number;
  color: string;
  adjacency: Map<number, Set<string>>;

  // Direction constants
  static readonly UP = 0;
  static readonly DOWN = 1;
  static readonly NORTH = 2;
  static readonly SOUTH = 3;
  static readonly EAST = 4;
  static readonly WEST = 5;

  constructor(config: WFCTile3DConfig) {
    this.id = config.id;
    this.weight = config.weight ?? 1.0;
    this.color = config.color ?? '#808080';
    
    // Initialize adjacency map
    this.adjacency = new Map();
    
    if (config.adjacency) {
      if (config.adjacency.up) {
        this.adjacency.set(WFCTile3D.UP, new Set(config.adjacency.up));
      }
      if (config.adjacency.down) {
        this.adjacency.set(WFCTile3D.DOWN, new Set(config.adjacency.down));
      }
      if (config.adjacency.north) {
        this.adjacency.set(WFCTile3D.NORTH, new Set(config.adjacency.north));
      }
      if (config.adjacency.south) {
        this.adjacency.set(WFCTile3D.SOUTH, new Set(config.adjacency.south));
      }
      if (config.adjacency.east) {
        this.adjacency.set(WFCTile3D.EAST, new Set(config.adjacency.east));
      }
      if (config.adjacency.west) {
        this.adjacency.set(WFCTile3D.WEST, new Set(config.adjacency.west));
      }
    }
  }

  /**
   * Check if this tile can be adjacent to another tile in a given direction
   */
  canBeAdjacentTo(tileId: string, direction: number): boolean {
    const allowed = this.adjacency.get(direction);
    if (!allowed) return true; // No constraints means all tiles allowed
    return allowed.has(tileId);
  }

  /**
   * Get opposite direction
   */
  static getOppositeDirection(direction: number): number {
    switch (direction) {
      case WFCTile3D.UP: return WFCTile3D.DOWN;
      case WFCTile3D.DOWN: return WFCTile3D.UP;
      case WFCTile3D.NORTH: return WFCTile3D.SOUTH;
      case WFCTile3D.SOUTH: return WFCTile3D.NORTH;
      case WFCTile3D.EAST: return WFCTile3D.WEST;
      case WFCTile3D.WEST: return WFCTile3D.EAST;
      default: return direction;
    }
  }
}
