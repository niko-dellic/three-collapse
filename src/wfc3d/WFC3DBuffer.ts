import { WFCTile3D } from './WFCTile3D';

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
      [...this.possibleTiles].filter(t => allowedTiles.has(t))
    );
    
    return this.possibleTiles.size < before;
  }
}

/**
 * 3D buffer for Wave Function Collapse
 */
export class WFC3DBuffer {
  width: number;
  height: number;
  depth: number;
  cells: Cell[][][];
  tiles: Map<string, WFCTile3D>;

  constructor(width: number, height: number, depth: number, tiles: WFCTile3D[]) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.tiles = new Map(tiles.map(t => [t.id, t]));

    // Initialize all cells with all possible tiles
    const tileIds = tiles.map(t => t.id);
    this.cells = [];
    
    for (let x = 0; x < width; x++) {
      this.cells[x] = [];
      for (let y = 0; y < height; y++) {
        this.cells[x][y] = [];
        for (let z = 0; z < depth; z++) {
          this.cells[x][y][z] = new Cell(tileIds);
        }
      }
    }
  }

  /**
   * Get cell at position
   */
  getCell(x: number, y: number, z: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
      return null;
    }
    return this.cells[x][y][z];
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
  getNeighborCoords(x: number, y: number, z: number, direction: number): [number, number, number] | null {
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
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < this.depth; z++) {
          if (!this.cells[x][y][z].collapsed) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Check if buffer is in a valid state (no contradictions)
   */
  isValid(): boolean {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < this.depth; z++) {
          const cell = this.cells[x][y][z];
          if (!cell.collapsed && cell.possibleTiles.size === 0) {
            return false; // Contradiction detected
          }
        }
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
}
