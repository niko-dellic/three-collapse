import { WFCTile3D } from './WFCTile3D';
import { WFC3DBuffer } from './WFC3DBuffer';

export interface WFC3DOptions {
  width: number;
  height: number;
  depth: number;
  tiles: WFCTile3D[];
  seed?: number;
}

/**
 * 3D Wave Function Collapse solver
 */
export class WFC3D {
  buffer: WFC3DBuffer;
  tiles: WFCTile3D[];
  rng: () => number;

  constructor(options: WFC3DOptions) {
    this.tiles = options.tiles;
    this.buffer = new WFC3DBuffer(
      options.width,
      options.height,
      options.depth,
      options.tiles
    );

    // Simple seeded random number generator
    if (options.seed !== undefined) {
      let seed = options.seed;
      this.rng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    } else {
      this.rng = Math.random;
    }
  }

  /**
   * Run the WFC algorithm
   */
  async generate(onProgress?: (progress: number) => void): Promise<boolean> {
    const totalCells = this.buffer.width * this.buffer.height * this.buffer.depth;
    let collapsedCells = 0;

    while (!this.buffer.isComplete()) {
      // Find cell with minimum entropy
      const cellToCollapse = this.findMinEntropyCell();
      
      if (!cellToCollapse) {
        // No uncollapsed cells found but not complete - contradiction
        return false;
      }

      const [x, y, z] = cellToCollapse;
      
      // Collapse the cell
      const tileId = this.selectTile(x, y, z);
      if (!tileId) {
        return false; // No valid tile found
      }

      this.buffer.cells[x][y][z].collapse(tileId);
      collapsedCells++;

      // Propagate constraints
      const success = this.propagate(x, y, z);
      
      if (!success) {
        return false; // Contradiction during propagation
      }

      // Report progress
      if (onProgress) {
        onProgress(collapsedCells / totalCells);
      }

      // Yield control periodically for async operation
      if (collapsedCells % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return this.buffer.isValid();
  }

  /**
   * Find cell with minimum entropy (excluding collapsed cells)
   */
  private findMinEntropyCell(): [number, number, number] | null {
    let minEntropy = Infinity;
    const candidates: [number, number, number][] = [];

    for (let x = 0; x < this.buffer.width; x++) {
      for (let y = 0; y < this.buffer.height; y++) {
        for (let z = 0; z < this.buffer.depth; z++) {
          const cell = this.buffer.cells[x][y][z];
          
          if (cell.collapsed) continue;

          const entropy = cell.entropy;
          
          if (entropy === 0) continue; // Skip impossible cells
          
          if (entropy < minEntropy) {
            minEntropy = entropy;
            candidates.length = 0;
            candidates.push([x, y, z]);
          } else if (entropy === minEntropy) {
            candidates.push([x, y, z]);
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Pick random cell from candidates with same entropy
    const index = Math.floor(this.rng() * candidates.length);
    return candidates[index];
  }

  /**
   * Select a tile for a cell based on weights
   */
  private selectTile(x: number, y: number, z: number): string | null {
    const cell = this.buffer.cells[x][y][z];
    const possibleTileIds = Array.from(cell.possibleTiles);

    if (possibleTileIds.length === 0) return null;

    // Calculate total weight
    let totalWeight = 0;
    const weights: number[] = [];
    
    for (const tileId of possibleTileIds) {
      const tile = this.buffer.tiles.get(tileId);
      const weight = tile?.weight ?? 1.0;
      weights.push(weight);
      totalWeight += weight;
    }

    // Select based on weighted random
    let random = this.rng() * totalWeight;
    
    for (let i = 0; i < possibleTileIds.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return possibleTileIds[i];
      }
    }

    return possibleTileIds[possibleTileIds.length - 1];
  }

  /**
   * Propagate constraints after a cell is collapsed
   */
  private propagate(startX: number, startY: number, startZ: number): boolean {
    const stack: [number, number, number][] = [[startX, startY, startZ]];

    while (stack.length > 0) {
      const coords = stack.pop()!;
      const [x, y, z] = coords;
      const cell = this.buffer.cells[x][y][z];

      // Check all 6 directions
      for (let dir = 0; dir < 6; dir++) {
        const neighborCoords = this.buffer.getNeighborCoords(x, y, z, dir);
        if (!neighborCoords) continue;

        const [nx, ny, nz] = neighborCoords;
        const neighbor = this.buffer.getCell(nx, ny, nz);
        if (!neighbor || neighbor.collapsed) continue;

        // Calculate allowed tiles for neighbor
        const allowedTiles = new Set<string>();
        
        for (const tileId of cell.possibleTiles) {
          const tile = this.buffer.tiles.get(tileId);
          if (!tile) continue;

          const adjacentIds = tile.adjacency.get(dir);
          if (!adjacentIds) {
            // No constraints - all tiles allowed
            for (const t of this.tiles) {
              allowedTiles.add(t.id);
            }
          } else {
            for (const adjId of adjacentIds) {
              allowedTiles.add(adjId);
            }
          }
        }

        // Constrain neighbor
        const changed = neighbor.constrain(allowedTiles);
        
        if (neighbor.possibleTiles.size === 0) {
          return false; // Contradiction
        }

        if (changed) {
          stack.push([nx, ny, nz]);
        }
      }
    }

    return true;
  }

  /**
   * Reset the buffer to initial state
   */
  reset(): void {
    this.buffer = new WFC3DBuffer(
      this.buffer.width,
      this.buffer.height,
      this.buffer.depth,
      this.tiles
    );
  }
}
