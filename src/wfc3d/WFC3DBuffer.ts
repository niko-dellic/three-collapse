import { WFCTile3D } from "./WFCTile3D";

/**
 * Cell in the 3D grid that tracks possible tile states
 */
class Cell {
  possibleTiles: Set<string>;
  collapsed: boolean;
  tileId: string | null;

  constructor(tileIds: string[]) {
    this.possibleTiles = new Set(tileIds);
    this.collapsed = false;
    this.tileId = null;
  }

  get entropy(): number {
    if (this.collapsed) return 0;
    return this.possibleTiles.size;
  }

  collapse(tileId: string): void {
    this.collapsed = true;
    this.tileId = tileId;
    this.possibleTiles.clear();
    this.possibleTiles.add(tileId);
  }

  constrain(allowedTiles: Set<string>): boolean {
    if (this.collapsed) return false;

    const before = this.possibleTiles.size;
    this.possibleTiles = new Set(
      [...this.possibleTiles].filter((t) => allowedTiles.has(t))
    );

    return this.possibleTiles.size < before;
  }
}

/**
 * 3D buffer for Wave Function Collapse using sparse map structure
 */
export class WFC3DBuffer {
  width: number;
  height: number;
  depth: number;
  cells: Map<string, Cell>; // Sparse map: key = "x,y,z"
  tiles: Map<string, WFCTile3D>;

  constructor(
    width: number,
    height: number,
    depth: number,
    tiles: WFCTile3D[]
  ) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.tiles = new Map(tiles.map((t) => [t.id, t]));

    // Initialize all cells with all possible tiles using sparse map
    const tileIds = tiles.map((t) => t.id);
    this.cells = new Map();

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const key = this.coordToKey(x, y, z);
          this.cells.set(key, new Cell(tileIds));
        }
      }
    }
  }

  /**
   * Convert coordinates to map key
   */
  coordToKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Parse map key back to coordinates
   */
  keyToCoord(key: string): [number, number, number] {
    const parts = key.split(",").map(Number);
    return [parts[0], parts[1], parts[2]];
  }

  /**
   * Check if cell exists in sparse map
   */
  hasCell(x: number, y: number, z: number): boolean {
    return this.cells.has(this.coordToKey(x, y, z));
  }

  /**
   * Get all existing cell coordinates
   */
  getAllCoordinates(): Array<[number, number, number]> {
    return Array.from(this.cells.keys()).map((key) => this.keyToCoord(key));
  }

  /**
   * Get cell at position
   */
  getCell(x: number, y: number, z: number): Cell | null {
    const key = this.coordToKey(x, y, z);
    return this.cells.get(key) || null;
  }

  /**
   * Get neighbor in a specific direction
   */
  getNeighbor(x: number, y: number, z: number, direction: number): Cell | null {
    switch (direction) {
      case WFCTile3D.UP:
        return this.getCell(x, y + 1, z);
      case WFCTile3D.DOWN:
        return this.getCell(x, y - 1, z);
      case WFCTile3D.NORTH:
        return this.getCell(x, y, z - 1);
      case WFCTile3D.SOUTH:
        return this.getCell(x, y, z + 1);
      case WFCTile3D.EAST:
        return this.getCell(x + 1, y, z);
      case WFCTile3D.WEST:
        return this.getCell(x - 1, y, z);
      default:
        return null;
    }
  }

  /**
   * Get neighbor coordinates in a specific direction
   */
  getNeighborCoords(
    x: number,
    y: number,
    z: number,
    direction: number
  ): [number, number, number] | null {
    switch (direction) {
      case WFCTile3D.UP:
        return [x, y + 1, z];
      case WFCTile3D.DOWN:
        return [x, y - 1, z];
      case WFCTile3D.NORTH:
        return [x, y, z - 1];
      case WFCTile3D.SOUTH:
        return [x, y, z + 1];
      case WFCTile3D.EAST:
        return [x + 1, y, z];
      case WFCTile3D.WEST:
        return [x - 1, y, z];
      default:
        return null;
    }
  }

  /**
   * Check if all cells are collapsed
   */
  isComplete(): boolean {
    for (const cell of this.cells.values()) {
      if (!cell.collapsed) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if buffer is in a valid state (no contradictions)
   */
  isValid(): boolean {
    for (const cell of this.cells.values()) {
      if (!cell.collapsed && cell.possibleTiles.size === 0) {
        return false; // Contradiction detected
      }
    }
    return true;
  }

  /**
   * Get the collapsed tile ID at a position
   */
  getTileAt(x: number, y: number, z: number): string | null {
    const cell = this.getCell(x, y, z);
    return cell?.tileId ?? null;
  }

  /**
   * Expand the buffer in specified directions
   * Returns a new buffer with expanded dimensions and existing cells copied
   */
  expand(expansions: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  }): WFC3DBuffer {
    const newWidth = this.width + expansions.xMin + expansions.xMax;
    const newHeight = this.height + expansions.yMin + expansions.yMax;
    const newDepth = this.depth + expansions.zMin + expansions.zMax;

    // Create new buffer
    const tiles = Array.from(this.tiles.values());
    const newBuffer = new WFC3DBuffer(newWidth, newHeight, newDepth, tiles);

    // Copy existing cells to their new positions
    for (const [key, oldCell] of this.cells.entries()) {
      const [x, y, z] = this.keyToCoord(key);
      const newX = x + expansions.xMin;
      const newY = y + expansions.yMin;
      const newZ = z + expansions.zMin;
      const newKey = newBuffer.coordToKey(newX, newY, newZ);
      const newCell = newBuffer.cells.get(newKey);

      if (newCell) {
        if (oldCell.collapsed && oldCell.tileId) {
          newCell.collapse(oldCell.tileId);
        } else {
          // Copy possible tiles for uncollapsed cells
          newCell.possibleTiles = new Set(oldCell.possibleTiles);
        }
      }
    }

    return newBuffer;
  }

  /**
   * Serialize buffer to transferable object for worker communication
   */
  serialize(): SerializedBuffer {
    const cellData: SerializedCell[] = [];

    for (const [key, cell] of this.cells.entries()) {
      const [x, y, z] = this.keyToCoord(key);
      cellData.push({
        x,
        y,
        z,
        collapsed: cell.collapsed,
        tileId: cell.tileId,
        possibleTiles: Array.from(cell.possibleTiles),
      });
    }

    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
      cellData,
    };
  }

  /**
   * Deserialize buffer from worker message
   */
  static deserialize(
    serialized: SerializedBuffer,
    tiles: WFCTile3D[]
  ): WFC3DBuffer {
    // Create buffer with dimensions (will create empty sparse grid)
    const buffer = new WFC3DBuffer(
      serialized.width,
      serialized.height,
      serialized.depth,
      tiles
    );

    // Clear the auto-populated cells
    buffer.cells.clear();

    // Restore cell states from serialized data
    for (const cellData of serialized.cellData) {
      const key = buffer.coordToKey(cellData.x, cellData.y, cellData.z);
      const cell = new Cell(tiles.map((t) => t.id));
      cell.collapsed = cellData.collapsed;
      cell.tileId = cellData.tileId;
      cell.possibleTiles = new Set(cellData.possibleTiles);
      buffer.cells.set(key, cell);
    }

    return buffer;
  }

  /**
   * Convert sparse map to 3D array (for backward compatibility)
   */
  toArray(): string[][][] {
    const grid: string[][][] = [];

    for (let x = 0; x < this.width; x++) {
      grid[x] = [];
      for (let y = 0; y < this.height; y++) {
        grid[x][y] = [];
        for (let z = 0; z < this.depth; z++) {
          const cell = this.getCell(x, y, z);
          grid[x][y][z] = cell?.tileId || "";
        }
      }
    }

    return grid;
  }
}

/**
 * Serialized cell data for worker transfer
 */
export interface SerializedCell {
  x: number;
  y: number;
  z: number;
  collapsed: boolean;
  tileId: string | null;
  possibleTiles: string[];
}

/**
 * Serialized buffer for worker transfer
 */
export interface SerializedBuffer {
  width: number;
  height: number;
  depth: number;
  cellData: SerializedCell[];
}
