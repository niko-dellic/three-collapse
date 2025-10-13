# Continuous Expansion & Multi-Worker Support

This document describes the new continuous expansion and multi-worker features added to the three-collapse library.

## Features Overview

### 1. Continuous Expansion

Expand existing WFC grids in real-time while preserving the already-generated structure. This allows you to:

- Dynamically increase grid dimensions
- Maintain continuity with existing collapsed cells
- Avoid regenerating the entire grid from scratch

### 2. Multi-Worker Support

Leverage multiple Web Workers for parallel WFC generation:

- Distribute work across CPU cores
- Generate regions in parallel
- Configurable worker pool with automatic task queuing

## Usage

### Basic Expansion

```typescript
import { WFC3D, WFCTile3D } from "three-collapse";

// Create initial WFC instance
const wfc = new WFC3D({
  width: 10,
  height: 8,
  depth: 10,
  tiles: myTiles,
  seed: 12345,
});

// Generate initial grid
await wfc.generate();

// Expand the grid in positive X and Z directions
await wfc.expand(
  {
    xMin: 0, // No expansion in -X direction
    xMax: 5, // Expand by 5 cells in +X direction
    yMin: 0, // No expansion in -Y direction
    yMax: 2, // Expand by 2 cells in +Y direction
    zMin: 0, // No expansion in -Z direction
    zMax: 5, // Expand by 5 cells in +Z direction
  },
  (progress) => {
    console.log(`Expansion progress: ${(progress * 100).toFixed(0)}%`);
  }
);

// The buffer is now 15x10x15 (10+5, 8+2, 10+5)
```

### Buffer Serialization for Workers

```typescript
import { WFC3DBuffer } from "three-collapse";

// Serialize a buffer for worker transfer
const serialized = buffer.serialize();

// In worker: deserialize
const buffer = WFC3DBuffer.deserialize(serialized, tiles);
```

### Worker Pool

```typescript
import { WorkerPool } from "three-collapse";

// Create a worker pool
const pool = new WorkerPool(true); // Use all available CPU cores
// OR
const pool = new WorkerPool(4); // Use exactly 4 workers
// OR
const pool = new WorkerPool(false); // Single worker (default behavior)

// Execute a task
const result = await pool.executeTask({
  id: "generate-1",
  message: {
    type: "generate",
    width: 20,
    height: 10,
    depth: 20,
    tiles: prepareTilesForWorker(tiles),
    seed: 12345,
  },
});

// Clean up when done
pool.terminate();
```

### Multi-Worker Generation

```typescript
import { generateWithWorkers, WorkerPool } from "three-collapse";

const pool = new WorkerPool(true);

const grid = await generateWithWorkers(
  20, // width
  10, // height
  20, // depth
  tiles,
  pool,
  12345, // optional seed
  (progress) => console.log(`Progress: ${(progress * 100).toFixed(0)}%`)
);

pool.terminate();
```

### Region Splitting

```typescript
import { splitGridIntoRegions, getBoundaryCells } from "three-collapse";

// Split a grid into regions for parallel processing
const regions = splitGridIntoRegions(30, 20, 30, 4);
// Returns array of Region3D objects with xMin, xMax, yMin, yMax, zMin, zMax

// Get boundary cells between regions
const boundaries = getBoundaryCells(30, 20, 30, regions);
// Returns array of [x, y, z] coordinates
```

## Demo Integration

The model demo (`examples/models/demo.ts`) now includes:

### Auto-Expansion Mode

1. Check the "Auto-expand mode" checkbox
2. Adjust width/height/depth sliders
3. When dimensions increase, the grid automatically expands
4. When dimensions decrease, a full regeneration is required

### Multi-Worker Configuration

1. Enable "Enable multi-worker" checkbox
2. Set the desired worker count (1 to max CPU cores)
3. Note: This is experimental and may not show performance benefits for small grids

## How It Works

### Expansion Algorithm

1. **Buffer Expansion**: Create a new larger buffer and copy existing cells
2. **Edge Constraint Propagation**:
   - Find all collapsed cells adjacent to new regions
   - Propagate their adjacency constraints into new cells
   - This ensures continuity between old and new regions
3. **Selective Generation**: Run WFC only on uncollapsed cells
4. **Progress Tracking**: Report progress based on total vs. collapsed cells

### Multi-Worker Strategy

1. **Region Splitting**: Divide grid into approximately equal cubic regions
2. **Boundary Pre-Collapse**: Generate a boundary layer on main thread
3. **Parallel Generation**: Send each region to worker pool with boundary constraints
4. **Result Merging**: Combine all region results into single grid

## Performance Considerations

### Expansion

- **Best for**: Incremental growth scenarios (exploration, procedural generation)
- **Overhead**: Minimal - only new cells are processed
- **Constraint Continuity**: Edges are fully constrained, preventing contradictions

### Multi-Worker

- **Best for**: Large grids (30×30×30 or larger)
- **Overhead**: Worker creation, message passing, boundary generation
- **Scaling**: Near-linear speedup for large grids with many workers
- **Small Grids**: May be slower than single worker due to overhead

## Worker Message Types

### Generate Message

```typescript
{
  type: 'generate',
  width: number,
  height: number,
  depth: number,
  tiles: WFCTile3DConfig[],
  seed?: number,
  region?: {
    xMin: number, xMax: number,
    yMin: number, yMax: number,
    zMin: number, zMax: number
  },
  preCollapsedCells?: Array<{
    x: number, y: number, z: number, tileId: string
  }>
}
```

### Expand Message

```typescript
{
  type: 'expand',
  existingBuffer: SerializedBuffer,
  expansions: {
    xMin: number, xMax: number,
    yMin: number, yMax: number,
    zMin: number, zMax: number
  },
  tiles: WFCTile3DConfig[],
  seed?: number
}
```

## API Reference

### WFC3DBuffer

#### `expand(expansions): WFC3DBuffer`

Creates a new expanded buffer with existing cells copied.

#### `serialize(): SerializedBuffer`

Serializes buffer for worker transfer.

#### `static deserialize(serialized, tiles): WFC3DBuffer`

Reconstructs buffer from serialized data.

### WFC3D

#### `async expand(expansions, onProgress?): Promise<boolean>`

Expands the grid and runs WFC on new cells.

- Returns `true` on success, `false` if contradiction occurs
- Progress callback receives values from 0 to 1

### WorkerPool

#### `constructor(workerCount: number | boolean)`

- `true` = use all available CPU cores
- `number` = use specific count (capped at available cores)
- `false` = single worker

#### `async executeTask(task: WorkerTask): Promise<any>`

Execute a task on an available worker. Queues if all workers busy.

#### `getActiveWorkerCount(): number`

Returns number of currently active tasks.

#### `getWorkerCount(): number`

Returns total number of workers in pool.

#### `terminate(): void`

Terminates all workers and clears queue.

### Utility Functions

#### `splitGridIntoRegions(width, height, depth, workerCount): Region3D[]`

Divides grid into regions for parallel processing.

#### `getBoundaryCells(width, height, depth, regions): Array<[number, number, number]>`

Returns coordinates of cells on region boundaries.

#### `generateWithWorkers(width, height, depth, tiles, workerPool, seed?, onProgress?): Promise<string[][][]>`

High-level function for multi-worker generation with automatic region splitting and boundary handling.

## Limitations & Future Work

### Current Limitations

1. **Expansion direction**: Can only expand (increase dimensions), not shrink
2. **Boundary generation**: Simplified approach - may cause some edge artifacts
3. **Progress tracking**: Aggregate progress from multiple workers is approximate
4. **Memory**: Full grid held in memory (no streaming)

### Future Enhancements

1. Incremental renderer updates (track changes, update only new instances)
2. Better boundary collapse strategy (mini-WFC on boundaries)
3. Worker communication for edge coordination during generation
4. Streaming/chunked generation for very large grids
5. Undo/redo support for expansions

## Examples

See the working demo at `examples/models/demo.ts` which demonstrates:

- Auto-expansion when sliders change
- Worker pool configuration UI
- Real-time progress tracking
- Expansion state management

Run the demo:

```bash
npm run dev
# Open http://localhost:5173/models.html
```

## Troubleshooting

### Expansion fails with contradiction

- The adjacency rules may be too restrictive
- Try adjusting tile weights or adjacency rules
- Consider using a new seed for the expansion

### Multi-worker shows no performance benefit

- Grid may be too small (overhead dominates)
- Try larger grids (30×30×30 or bigger)
- Check browser console for worker errors

### Memory issues with large expansions

- Break expansion into smaller steps
- Dispose old renderers before creating new ones
- Consider limiting max grid size

## Contributing

To extend these features:

1. Add new worker message types in `src/wfc.worker.ts`
2. Implement handlers in worker's `onmessage`
3. Update `WorkerPool` to support new task types
4. Add corresponding API methods to `WFC3D` or utility functions
