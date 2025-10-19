import { WorkerPool } from "./WorkerPool";
import {
  splitGridIntoRegions,
  getBoundaryCells,
  getCellsForRegion,
} from "./RegionSplitter";
import { WFC3D, WFCTile3D, type ModelTile3DConfig } from "../wfc3d";

/**
 * Callback for tile update notifications
 */
export type TileUpdateCallback = (
  x: number,
  y: number,
  z: number,
  tileId: string
) => void;

/**
 * Generate WFC grid using multiple workers for parallel processing
 */
export async function generateWithWorkers(
  width: number,
  height: number,
  depth: number,
  tiles: ModelTile3DConfig[] | Omit<ModelTile3DConfig, "model">[],
  workerPool: WorkerPool,
  seed?: number,
  onProgress?: (progress: number) => void,
  onTileUpdate?: TileUpdateCallback
): Promise<string[][][]> {
  const workerCount = workerPool.getWorkerCount();

  // Initialize internal result grid
  const result: string[][][] = Array(width)
    .fill(null)
    .map(() =>
      Array(height)
        .fill(null)
        .map(() => Array(depth).fill(""))
    );

  // Create tile update handler that updates internal grid and calls user callback
  const handleTileUpdate = (
    x: number,
    y: number,
    z: number,
    tileId: string
  ) => {
    // Update internal grid
    if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth) {
      result[x][y][z] = tileId;
    }
    // Call user callback if provided
    if (onTileUpdate) {
      onTileUpdate(x, y, z, tileId);
    }
  };

  // If only one worker, use simple generation
  if (workerCount === 1) {
    return await generateSingleWorker(
      width,
      height,
      depth,
      tiles,
      workerPool,
      seed,
      onProgress,
      handleTileUpdate
    );
  }

  // Split grid into regions
  const regions = splitGridIntoRegions(width, height, depth, workerCount);

  // Get ALL boundary cells
  const boundaryCells = getBoundaryCells(width, height, depth, regions);
  const boundarySet = new Set(
    boundaryCells.map(([x, y, z]) => `${x},${y},${z}`)
  );

  // Pre-collapse all boundaries on main thread
  const preCollapsedCells = await generateBoundaries(
    width,
    height,
    depth,
    tiles,
    boundaryCells,
    seed,
    handleTileUpdate
  );

  // Get interior cells for each region
  const regionCellAssignments = regions.map((region) =>
    getCellsForRegion(region, boundarySet)
  );

  // Log cell distribution
  console.log(`Distributing cells across ${workerCount} workers:`);
  regionCellAssignments.forEach((cells, index) => {
    console.log(`  Worker ${index} assigned ${cells.length} cells`);
  });

  // Create tasks with specific cell assignments
  const regionPromises = regionCellAssignments.map((assignedCells, index) =>
    workerPool.executeTask({
      id: `generate-region-${index}`,
      message: {
        type: "generate",
        width,
        height,
        depth,
        tiles,
        seed: seed ? seed + index : undefined,
        assignedCells, // NEW: Only these cells
        preCollapsedCells,
      },
      onTileUpdate: handleTileUpdate,
    })
  );

  // Wait for all regions to complete
  await Promise.all(regionPromises);

  // Internal grid is already populated via handleTileUpdate
  if (onProgress) {
    onProgress(1.0);
  }

  return result;
}

/**
 * Generate using a single worker
 */
async function generateSingleWorker(
  width: number,
  height: number,
  depth: number,
  tiles: ModelTile3DConfig[] | Omit<ModelTile3DConfig, "model">[],
  workerPool: WorkerPool,
  seed?: number,
  _onProgress?: (progress: number) => void,
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void
): Promise<string[][][]> {
  // Note: Progress tracking for single worker is handled by the worker itself
  return await workerPool.executeTask({
    id: "generate-single",
    message: {
      type: "generate",
      width,
      height,
      depth,
      tiles,
      seed,
    },
    onTileUpdate,
  });
}

/**
 * Generate boundary cells on main thread
 */
async function generateBoundaries(
  width: number,
  height: number,
  depth: number,
  tiles: ModelTile3DConfig[] | Omit<ModelTile3DConfig, "model">[],
  boundaryCells: Array<[number, number, number]>,
  seed?: number,
  onTileUpdate?: TileUpdateCallback
): Promise<Array<{ x: number; y: number; z: number; tileId: string }>> {
  // Create WFC instance
  const wfcTiles = tiles.map(
    (config) => new WFCTile3D(config as ModelTile3DConfig)
  );
  const wfc = new WFC3D({
    width,
    height,
    depth,
    tiles: wfcTiles,
    seed,
  });

  const preCollapsed: Array<{
    x: number;
    y: number;
    z: number;
    tileId: string;
  }> = [];

  // Collapse ALL boundary cells (not just 50)
  console.log(`Pre-collapsing ${boundaryCells.length} boundary cells...`);
  for (const [x, y, z] of boundaryCells) {
    const cell = wfc.buffer.getCell(x, y, z);

    if (cell && !cell.collapsed && cell.possibleTiles.size > 0) {
      const possibleTiles = Array.from(cell.possibleTiles);
      const tileId =
        possibleTiles[Math.floor(Math.random() * possibleTiles.length)];
      cell.collapse(tileId);

      // Propagate constraints to neighbors
      wfc.propagate(x, y, z);

      preCollapsed.push({ x, y, z, tileId });

      // Trigger tile update callback for rendering
      if (onTileUpdate) {
        onTileUpdate(x, y, z, tileId);
      }
    }
  }
  console.log(
    `Pre-collapsed ${preCollapsed.length} boundary cells successfully`
  );

  return preCollapsed;
}
