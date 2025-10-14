import { WorkerPool } from "./WorkerPool";
import {
  splitGridIntoRegions,
  getBoundaryCells,
  type Region3D,
} from "./RegionSplitter";
import { WFC3D, WFCTile3D, type WFCTile3DConfig } from "../wfc3d";

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
  tiles: WFCTile3DConfig[],
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

  // Generate boundary layer on main thread
  const boundaryCells = getBoundaryCells(width, height, depth, regions);
  const preCollapsedCells = await generateBoundaries(
    width,
    height,
    depth,
    tiles,
    boundaryCells,
    seed
  );

  // Generate each region in parallel
  const regionPromises = regions.map((region, index) =>
    generateRegion(
      width,
      height,
      depth,
      tiles,
      region,
      preCollapsedCells,
      workerPool,
      seed ? seed + index : undefined,
      handleTileUpdate
    )
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
  tiles: WFCTile3DConfig[],
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
  tiles: WFCTile3DConfig[],
  boundaryCells: Array<[number, number, number]>,
  seed?: number
): Promise<Array<{ x: number; y: number; z: number; tileId: string }>> {
  // Create WFC instance
  const wfcTiles = tiles.map((config) => new WFCTile3D(config));
  const wfc = new WFC3D({
    width,
    height,
    depth,
    tiles: wfcTiles,
    seed,
  });

  // Collapse only boundary cells (simplified - just collapse a subset)
  const preCollapsed: Array<{
    x: number;
    y: number;
    z: number;
    tileId: string;
  }> = [];

  // For now, we'll collapse a small number of boundary cells
  // In a full implementation, you'd want to run WFC focusing on boundaries
  const maxBoundaries = Math.min(boundaryCells.length, 50);
  for (let i = 0; i < maxBoundaries; i++) {
    const [x, y, z] = boundaryCells[i];
    const cell = wfc.buffer.getCell(x, y, z);

    if (cell && !cell.collapsed && cell.possibleTiles.size > 0) {
      const possibleTiles = Array.from(cell.possibleTiles);
      const tileId =
        possibleTiles[Math.floor(Math.random() * possibleTiles.length)];
      cell.collapse(tileId);
      preCollapsed.push({ x, y, z, tileId });
    }
  }

  return preCollapsed;
}

/**
 * Generate a specific region using worker pool
 */
async function generateRegion(
  fullWidth: number,
  fullHeight: number,
  fullDepth: number,
  tiles: WFCTile3DConfig[],
  region: Region3D,
  preCollapsedCells: Array<{ x: number; y: number; z: number; tileId: string }>,
  workerPool: WorkerPool,
  seed?: number,
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void
): Promise<string[][][]> {
  // Filter pre-collapsed cells that are in this region or adjacent
  const relevantCells = preCollapsedCells.filter(
    (cell) =>
      cell.x >= region.xMin - 1 &&
      cell.x <= region.xMax &&
      cell.y >= region.yMin - 1 &&
      cell.y <= region.yMax &&
      cell.z >= region.zMin - 1 &&
      cell.z <= region.zMax
  );

  return await workerPool.executeTask({
    id: `generate-region-${region.xMin}-${region.yMin}-${region.zMin}`,
    message: {
      type: "generate",
      width: fullWidth,
      height: fullHeight,
      depth: fullDepth,
      tiles,
      seed,
      region,
      preCollapsedCells: relevantCells,
    },
    onTileUpdate,
  });
}
