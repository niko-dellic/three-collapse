# Real-time Tile Updates

The WFC system now supports real-time tile update notifications, allowing you to render tiles as they're solved rather than waiting for the entire generation to complete.

## Overview

When using `generateWithWorkers()`, you can now receive immediate notifications every time a tile is collapsed. The system automatically maintains an internal grid that's progressively populated, and you can optionally provide a callback to update your renderer in real-time.

## Key Features

- **Immediate Updates**: Receive notifications as soon as each tile is solved
- **Automatic Grid Management**: The internal result grid is automatically populated
- **Optional Callbacks**: User callbacks are optional - the system works without them
- **Multi-Worker Support**: Each worker sends updates independently (no coordination overhead)
- **Backward Compatible**: Existing code continues to work without modifications

## Basic Usage

```typescript
import {
  generateWithWorkers,
  WorkerPool,
  type TileUpdateCallback,
} from "three-collapse";

// Create worker pool
const workerPool = new WorkerPool(4);

// Optional: Define tile update callback for real-time rendering
const onTileUpdate: TileUpdateCallback = (x, y, z, tileId) => {
  // Update your renderer immediately
  renderer.updateTile(x, y, z, tileId);
};

// Generate with real-time updates
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed,
  (progress) => {
    // Progress callback (0.0 to 1.0)
    console.log(`Generation progress: ${(progress * 100).toFixed(1)}%`);
  },
  onTileUpdate // Optional tile update callback
);

// Grid is complete and fully populated
console.log("Generation complete!");
```

## Without Callbacks (Backward Compatible)

The callback is completely optional. If you don't provide it, the system still maintains the internal grid:

```typescript
// Works exactly as before - no callback needed
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed
);
```

## Example with Instanced Renderer

Here's a practical example using the `InstancedModelRenderer`:

```typescript
import {
  generateWithWorkers,
  WorkerPool,
  InstancedModelRenderer,
  type TileUpdateCallback,
} from "three-collapse";

// Setup renderer
const renderer = new InstancedModelRenderer(scene, modelData, cellSize);

// Track updates for progressive rendering
let updateCount = 0;
const batchSize = 10; // Update renderer every N tiles

const onTileUpdate: TileUpdateCallback = (x, y, z, tileId) => {
  updateCount++;

  // Update internal data structure
  if (tileId !== "air") {
    renderer.setTileAt(x, y, z, tileId);
  }

  // Batch updates for better performance
  if (updateCount % batchSize === 0) {
    renderer.updateInstances();
  }
};

// Generate with real-time updates
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed,
  undefined, // No progress callback
  onTileUpdate
);

// Final update to catch any remaining tiles
renderer.updateInstances();
```

## Performance Considerations

### Message Overhead

- Each tile collapse sends a small message (~40 bytes)
- For a 30x30x30 grid: ~27,000 messages
- Overhead is minimal compared to generation time

### Rendering Strategy

For optimal performance:

1. **Batch Updates**: Don't update renderer on every tile

   ```typescript
   if (updateCount % 10 === 0) {
     renderer.updateInstances();
   }
   ```

2. **Debounce**: Use time-based debouncing for large grids

   ```typescript
   let updateScheduled = false;
   const onTileUpdate = (x, y, z, tileId) => {
     grid[x][y][z] = tileId;
     if (!updateScheduled) {
       updateScheduled = true;
       requestAnimationFrame(() => {
         renderer.updateGrid(grid);
         updateScheduled = false;
       });
     }
   };
   ```

3. **Filter Tiles**: Skip rendering empty/air tiles
   ```typescript
   if (tileId !== "air" && tileId !== "") {
     renderer.updateTile(x, y, z, tileId);
   }
   ```

## Multi-Worker Behavior

When using multiple workers:

- Each worker sends tile updates for its region independently
- Updates may arrive out of order (this is expected and fine)
- The internal grid is thread-safe and handles concurrent updates
- No coordination overhead between workers

## Type Definitions

```typescript
/**
 * Callback for tile update notifications
 */
type TileUpdateCallback = (
  x: number,
  y: number,
  z: number,
  tileId: string
) => void;

/**
 * Generate WFC grid with optional real-time updates
 */
function generateWithWorkers(
  width: number,
  height: number,
  depth: number,
  tiles: WFCTile3DConfig[],
  workerPool: WorkerPool,
  seed?: number,
  onProgress?: (progress: number) => void,
  onTileUpdate?: TileUpdateCallback
): Promise<string[][][]>;
```

## Migration Guide

### Before (v1.x)

```typescript
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed
);
renderer.updateGrid(grid);
```

### After (v2.x) - With Real-time Updates

```typescript
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed,
  undefined, // no progress callback
  (x, y, z, tileId) => {
    renderer.updateTile(x, y, z, tileId);
  }
);
```

### After (v2.x) - Backward Compatible

```typescript
// No changes needed - works exactly the same!
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed
);
renderer.updateGrid(grid);
```

## Implementation Details

The system works by:

1. **Worker Messages**: Workers send `tile_update` messages immediately after each cell collapse
2. **Internal Grid**: `generateWithWorkers()` maintains an internal 3D array that's automatically populated
3. **Callback Forwarding**: Tile updates are forwarded to your optional callback
4. **Promise Resolution**: The function returns when all tiles are solved, grid is complete

This design ensures:

- Zero breaking changes
- Minimal overhead
- Maximum flexibility
- Excellent performance
