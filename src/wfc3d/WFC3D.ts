import { WFCTile3D } from "./WFCTile3D";
import { WFC3DBuffer } from "./WFC3DBuffer";

export interface WFC3DOptions {
  width: number;
  height: number;
  depth: number;
  tiles: WFCTile3D[];
  seed?: number;
}

export interface WFC3DError {
  type: "contradiction" | "no_valid_tile" | "propagation_failed";
  message: string;
  location?: { x: number; y: number; z: number };
  progress?: number;
  cellsCollapsed?: number;
  totalCells?: number;
  details?: string;
}

/**
 * 3D Wave Function Collapse solver
 */
export class WFC3D {
  buffer: WFC3DBuffer;
  tiles: WFCTile3D[];
  rng: () => number;
  lastError: WFC3DError | null = null;

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
  async generate(
    onProgress?: (progress: number) => void,
    onTileCollapse?: (x: number, y: number, z: number, tileId: string) => void
  ): Promise<boolean> {
    this.lastError = null; // Clear previous errors
    const totalCells = this.buffer.cells.size;
    let collapsedCells = 0;

    while (!this.buffer.isComplete()) {
      // Find cell with minimum entropy
      const cellToCollapse = this.findMinEntropyCell();

      if (!cellToCollapse) {
        // No uncollapsed cells found but not complete - contradiction
        this.lastError = {
          type: "contradiction",
          message: "No valid cells to collapse, but grid is incomplete",
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: "All remaining cells have zero entropy (no possible tiles)",
        };
        return false;
      }

      const [x, y, z] = cellToCollapse;

      // Collapse the cell
      const tileId = this.selectTile(x, y, z);
      if (!tileId) {
        const cell = this.buffer.getCell(x, y, z);
        this.lastError = {
          type: "no_valid_tile",
          message: `No valid tile found for cell at (${x}, ${y}, ${z})`,
          location: { x, y, z },
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: `Cell has ${
            cell?.possibleTiles.size || 0
          } possible tiles but couldn't select one`,
        };
        return false; // No valid tile found
      }

      const cell = this.buffer.getCell(x, y, z);
      if (cell) {
        cell.collapse(tileId);
        collapsedCells++;
      }

      // Notify tile collapse callback
      if (onTileCollapse) {
        onTileCollapse(x, y, z, tileId);
      }

      // Propagate constraints
      const success = this.propagate(x, y, z);

      if (!success) {
        this.lastError = {
          type: "propagation_failed",
          message: `Constraint propagation failed after collapsing cell (${x}, ${y}, ${z}) to '${tileId}'`,
          location: { x, y, z },
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: `Propagation created a contradiction in neighboring cells`,
        };
        return false; // Contradiction during propagation
      }

      // Report progress
      if (onProgress) {
        onProgress(collapsedCells / totalCells);
      }

      // Yield control periodically for async operation
      if (collapsedCells % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
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

    for (const [key, cell] of this.buffer.cells.entries()) {
      if (cell.collapsed) continue;

      const entropy = cell.entropy;

      if (entropy === 0) continue; // Skip impossible cells

      if (entropy < minEntropy) {
        minEntropy = entropy;
        candidates.length = 0;
        const [x, y, z] = this.buffer.keyToCoord(key);
        candidates.push([x, y, z]);
      } else if (entropy === minEntropy) {
        const [x, y, z] = this.buffer.keyToCoord(key);
        candidates.push([x, y, z]);
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
    const cell = this.buffer.getCell(x, y, z);
    if (!cell) return null;

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
  propagate(startX: number, startY: number, startZ: number): boolean {
    const stack: [number, number, number][] = [[startX, startY, startZ]];

    while (stack.length > 0) {
      const coords = stack.pop()!;
      const [x, y, z] = coords;
      const cell = this.buffer.getCell(x, y, z);
      if (!cell) continue;

      // Check all 6 directions
      for (let dir = 0; dir < 6; dir++) {
        const neighborCoords = this.buffer.getNeighborCoords(x, y, z, dir);
        if (!neighborCoords) continue;

        const [nx, ny, nz] = neighborCoords;
        const neighbor = this.buffer.getCell(nx, ny, nz);
        if (!neighbor || neighbor.collapsed) continue;

        // Calculate allowed tiles for neighbor using connector-based filtering
        const allowedTiles = new Set<string>();

        for (const tileId of cell.possibleTiles) {
          const tile = this.buffer.tiles.get(tileId);
          if (!tile) continue;

          // Filter all tiles for compatibility with this tile in this direction
          for (const candidateTile of this.tiles) {
            if (tile.canBeAdjacentTo(candidateTile, dir)) {
              allowedTiles.add(candidateTile.id);
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
   * Collapse a specific cell and propagate constraints
   * Returns the selected tileId or null if contradiction
   * Used by workers to collapse assigned cells
   */
  collapseCell(x: number, y: number, z: number): string | null {
    const cell = this.buffer.getCell(x, y, z);

    if (!cell || cell.collapsed || cell.possibleTiles.size === 0) {
      return null;
    }

    // Select tile based on weighted random
    const tileId = this.selectTile(x, y, z);

    if (!tileId) {
      return null;
    }

    // Collapse the cell
    cell.collapse(tileId);

    // Propagate constraints
    const success = this.propagate(x, y, z);

    return success ? tileId : null;
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

  /**
   * Expand the grid in specified directions and run WFC on new cells
   */
  async expand(
    expansions: {
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      zMin: number;
      zMax: number;
    },
    onProgress?: (progress: number) => void,
    onTileCollapse?: (x: number, y: number, z: number, tileId: string) => void
  ): Promise<boolean> {
    this.lastError = null; // Clear previous errors
    const oldBuffer = this.buffer;

    // Expand the buffer
    this.buffer = oldBuffer.expand(expansions);

    // Pre-constrain edge cells based on adjacent collapsed cells
    const constraintStack: [number, number, number][] = [];

    // Check all cells in old buffer region for edges that touch new cells
    for (const [key, oldCell] of oldBuffer.cells.entries()) {
      if (!oldCell.collapsed) continue;

      const [x, y, z] = oldBuffer.keyToCoord(key);

      // Translate to new buffer coordinates
      const newX = x + expansions.xMin;
      const newY = y + expansions.yMin;
      const newZ = z + expansions.zMin;

      // Check all 6 directions for new cells
      for (let dir = 0; dir < 6; dir++) {
        const neighborCoords = this.buffer.getNeighborCoords(
          newX,
          newY,
          newZ,
          dir
        );
        if (!neighborCoords) continue;

        const [nx, ny, nz] = neighborCoords;

        // Check if this neighbor is in the new region
        const isNewCell =
          nx < expansions.xMin ||
          nx >= expansions.xMin + oldBuffer.width ||
          ny < expansions.yMin ||
          ny >= expansions.yMin + oldBuffer.height ||
          nz < expansions.zMin ||
          nz >= expansions.zMin + oldBuffer.depth;

        if (isNewCell) {
          // Add to constraint stack to propagate
          constraintStack.push([newX, newY, newZ]);
          break; // Only need to add once per cell
        }
      }
    }

    // Propagate constraints from edge cells into new region
    while (constraintStack.length > 0) {
      const coords = constraintStack.pop()!;
      const [x, y, z] = coords;
      const cell = this.buffer.getCell(x, y, z);
      if (!cell) continue;

      for (let dir = 0; dir < 6; dir++) {
        const neighborCoords = this.buffer.getNeighborCoords(x, y, z, dir);
        if (!neighborCoords) continue;

        const [nx, ny, nz] = neighborCoords;
        const neighbor = this.buffer.getCell(nx, ny, nz);
        if (!neighbor || neighbor.collapsed) continue;

        // Calculate allowed tiles for neighbor using connector-based filtering
        const allowedTiles = new Set<string>();

        for (const tileId of cell.possibleTiles) {
          const tile = this.buffer.tiles.get(tileId);
          if (!tile) continue;

          // Filter all tiles for compatibility with this tile in this direction
          for (const candidateTile of this.tiles) {
            if (tile.canBeAdjacentTo(candidateTile, dir)) {
              allowedTiles.add(candidateTile.id);
            }
          }
        }

        // Constrain neighbor
        const changed = neighbor.constrain(allowedTiles);

        if (neighbor.possibleTiles.size === 0) {
          this.lastError = {
            type: "contradiction",
            message: `Edge constraint propagation created contradiction at (${nx}, ${ny}, ${nz})`,
            location: { x: nx, y: ny, z: nz },
            progress: 0,
            details: `Neighboring cell has no valid tiles after edge propagation`,
          };
          return false; // Contradiction
        }

        if (changed) {
          constraintStack.push([nx, ny, nz]);
        }
      }
    }

    // Run WFC only on uncollapsed cells
    const totalCells = this.buffer.cells.size;
    let collapsedCells = 0;

    // Count already collapsed cells
    for (const cell of this.buffer.cells.values()) {
      if (cell.collapsed) {
        collapsedCells++;
      }
    }

    while (!this.buffer.isComplete()) {
      // Find cell with minimum entropy
      const cellToCollapse = this.findMinEntropyCell();

      if (!cellToCollapse) {
        // No uncollapsed cells found but not complete - contradiction
        this.lastError = {
          type: "contradiction",
          message: "No valid cells to collapse during expansion",
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: "All remaining cells have zero entropy (no possible tiles)",
        };
        return false;
      }

      const [x, y, z] = cellToCollapse;

      // Collapse the cell
      const tileId = this.selectTile(x, y, z);
      if (!tileId) {
        const cell = this.buffer.getCell(x, y, z);
        this.lastError = {
          type: "no_valid_tile",
          message: `No valid tile found for cell at (${x}, ${y}, ${z}) during expansion`,
          location: { x, y, z },
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: `Cell has ${
            cell?.possibleTiles.size || 0
          } possible tiles but couldn't select one`,
        };
        return false; // No valid tile found
      }

      const cell = this.buffer.getCell(x, y, z);
      if (cell) {
        cell.collapse(tileId);
        collapsedCells++;
      }

      // Notify tile collapse callback
      if (onTileCollapse) {
        onTileCollapse(x, y, z, tileId);
      }

      // Propagate constraints
      const success = this.propagate(x, y, z);

      if (!success) {
        this.lastError = {
          type: "propagation_failed",
          message: `Constraint propagation failed after collapsing cell (${x}, ${y}, ${z}) to '${tileId}' during expansion`,
          location: { x, y, z },
          progress: collapsedCells / totalCells,
          cellsCollapsed: collapsedCells,
          totalCells,
          details: `Propagation created a contradiction in neighboring cells`,
        };
        return false; // Contradiction during propagation
      }

      // Report progress
      if (onProgress) {
        onProgress(collapsedCells / totalCells);
      }

      // Yield control periodically for async operation
      if (collapsedCells % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return this.buffer.isValid();
  }
}
