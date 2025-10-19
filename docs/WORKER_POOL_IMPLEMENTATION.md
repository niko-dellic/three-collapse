# Worker Pool Implementation

## Overview

The `WFCGenerator` now uses the `WorkerPool` for all WFC collapse operations, enabling parallel processing across all available CPU cores.

## Changes Made

### 1. Removed Single Worker

**Before:**

```typescript
private worker: Worker | null = null;
```

**After:**

```typescript
// Removed - now using WorkerPool exclusively
```

The single `worker` property has been removed entirely. All operations now go through the `WorkerPool`.

### 2. Refactored `runCollapse()` Method

**Before:**

- Created a single worker manually
- Used Promise-based message handling with `worker.onmessage`
- Manual worker lifecycle management

**After:**

```typescript
// Use WorkerPool to execute collapse
const taskId = `collapse_${Date.now()}_${Math.random()}`;

const result = await this.workerPool.executeTask({
  id: taskId,
  message: {
    type: "generate",
    width,
    height,
    depth,
    tiles: prepareTilesForWorker(this.tiles),
    seed,
    preCollapsedCells,
  },
  onTileUpdate: (x, y, z, tileId) => {
    // Handle real-time tile updates
  },
});
```

### 3. Simplified `dispose()` Method

**Before:**

```typescript
dispose(): void {
  this.workerPool.terminate();
  if (this.worker) {
    this.worker.terminate();
    this.worker = null;
  }
  // ... rest
}
```

**After:**

```typescript
dispose(): void {
  this.workerPool.terminate();  // Only need to terminate the pool
  // ... rest
}
```

### 4. Removed Unused Import

Removed `WorkerResponse` from type imports since the WorkerPool now handles all worker communication internally.

## How It Works

### Region-Based Parallelization

When multiple workers are available (workerCount > 1), the system uses **spatial decomposition** to distribute work:

1. **Grid Splitting** - `RegionSplitter` divides the grid into N regions (where N ≈ workerCount)
   - Regions are sized to be roughly cubic for better cache locality
   - Splits along largest dimensions first for balanced workload
2. **Boundary Generation** - Critical cells at region boundaries are collapsed first on the main thread
   - Ensures continuity between regions
   - Prevents contradictions at region interfaces
   - Acts as constraints for worker tasks
3. **Parallel Processing** - Each region is assigned to an available worker
   - Workers process their regions simultaneously
   - Boundary constraints ensure the results align
   - No inter-worker communication needed during collapse
4. **Result Merging** - All results are combined into the final grid
   - Internal grid is populated via real-time tile updates
   - No post-processing merge step required

### WorkerPool Benefits

1. **Automatic Worker Management**: The pool creates workers based on `navigator.hardwareConcurrency`
2. **Task Queuing**: Tasks are automatically queued when all workers are busy
3. **Worker Reuse**: Workers are reused across multiple operations
4. **True Parallel Execution**: Multiple regions processed simultaneously across CPU cores

### Task Lifecycle

**Single Worker (workerCount = 1):**

```
User calls generate/expand/expandFromCell
         ↓
    runCollapse() creates task
         ↓
  WorkerPool.executeTask() queues task
         ↓
  Task assigned to available worker
         ↓
  Worker processes entire WFC collapse
         ↓
  Real-time tile updates via onTileUpdate callback
         ↓
  Task completes, worker returns to pool
         ↓
  Result returned to caller
```

**Multiple Workers (workerCount > 1):**

```
User calls generate/expand/expandFromCell
         ↓
    runCollapse() uses generateWithWorkers()
         ↓
  Grid is split into N regions (using RegionSplitter)
         ↓
  Boundary cells generated on main thread
         ↓
  N tasks created (one per region)
         ↓
  WorkerPool distributes tasks to available workers
         ↓
  Workers process regions IN PARALLEL
         ↓
  Boundary cells ensure continuity between regions
         ↓
  Real-time tile updates from all workers
         ↓
  All regions complete, results merged
         ↓
  Combined result returned to caller
```

### Real-Time Updates

The `onTileUpdate` callback is called for each tile as it's collapsed:

```typescript
onTileUpdate: (x: number, y: number, z: number, tileId: string) => {
  // Convert buffer-local to world coordinates
  const worldX = x + bounds.minX;
  const worldY = y + bounds.minY;
  const worldZ = z + bounds.minZ;

  // Update internal grid
  internalGrid.set(this.coordToKey(worldX, worldY, worldZ), tileId);

  // Render tile immediately
  this.renderer.addTileInstance(tileId, worldX, worldY, worldZ);
};
```

## Operations Using WorkerPool

All WFC operations now benefit from the worker pool:

1. **`generate()`** - Initial grid generation
2. **`expand()`** - Grid face expansion
3. **`shrink()`** - Grid reduction
4. **`expandFromCell()`** - Local expansion from specific cells

## Performance Impact

### Single Worker (Before)

- ❌ One collapse operation at a time
- ❌ Single CPU core utilized
- ✅ UI remained responsive

### Worker Pool (After)

- ✅ Multiple operations can queue
- ✅ All CPU cores utilized
- ✅ UI remains responsive
- ✅ Better throughput for large operations
- ✅ Automatic load balancing

## Configuration

The worker pool size is configured in the constructor:

```typescript
const workerCount = options.workerCount ?? (navigator.hardwareConcurrency || 4);
this.workerPool = new WorkerPool(workerCount);
```

**Default**: Uses `navigator.hardwareConcurrency` (typically number of CPU cores)
**Fallback**: 4 workers if API not available

## Implementation Details

### Region Splitting Algorithm

The `RegionSplitter` uses an intelligent algorithm to divide the grid:

```typescript
// For 8 workers on a 40x20x40 grid:
// 1. Calculate splits: [2, 2, 2] = 8 regions (cubic-ish)
// 2. Split along largest dimensions first (X and Z)
// 3. Create regions:
//    Region 0: X[0,20),  Y[0,20), Z[0,20)
//    Region 1: X[20,40), Y[0,20), Z[0,20)
//    Region 2: X[0,20),  Y[0,20), Z[20,40)
//    ... (8 total regions)
```

### Boundary Cell Strategy

Boundary cells are pre-collapsed to ensure region continuity:

```typescript
// For each region boundary:
// 1. Identify interface cells (cells touching boundary)
// 2. Collapse a subset on main thread using WFC
// 3. Pass as preCollapsedCells to worker tasks
// 4. Workers respect these constraints during collapse
```

This approach is based on the [Marian42 infinite WFC article](https://marian42.de/article/infinite-wfc/) which describes how to maintain consistency across chunked regions.

## Future Enhancements

### Adaptive Region Sizing

Automatically adjust region sizes based on grid dimensions and worker count for optimal performance:

```typescript
// Future: Auto-optimize region distribution
await generator.generate({
  width: 100,
  height: 20,
  depth: 100,
  adaptiveRegions: true, // Automatically calculate best split
});
```

### Progress Aggregation

Currently, progress updates come from individual workers. For multi-region operations, aggregate progress:

```typescript
onProgress: (progress) => {
  this.aggregatedProgress =
    (region1.progress + region2.progress + ...) / regionCount;
  this.debugUI?.setProgress(this.aggregatedProgress * 100);
}
```

## Testing

To verify the worker pool is being used:

1. Open browser DevTools → Performance tab
2. Start a large generation operation
3. Check CPU usage - should see multiple worker threads active
4. Console logs show: `Running collapse on {dimensions} region with {n} pre-collapsed cells`

## Related Files

- **`src/utils/WorkerPool.ts`** - Worker pool implementation
- **`src/generators/WFCGenerator.ts`** - Main generator using pool
- **`src/wfc.worker.ts`** - Worker script that performs WFC collapse
- **`src/utils/MultiWorkerGenerator.ts`** - (Future) Region-based parallelization

## See Also

- [Sparse Grid Implementation](./SPARSE_GRID_IMPLEMENTATION.md)
- [WFC Generator Usage](./WFCGENERATOR_USAGE.md)
- [Library Usage Guide](./LIBRARY_USAGE.md)
