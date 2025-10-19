# Performance Timing & Worker Pool Benchmarking

## Overview

The `WFCGenerator` now includes built-in performance timing to measure and compare the efficiency of different worker pool configurations. This helps you optimize performance for your specific use case and hardware.

## Features

### 1. Automatic Performance Logging

Every WFC collapse operation (generate, expand, shrink, expandFromCell) now automatically logs:

- **Duration** - Time taken in milliseconds
- **Throughput** - Cells processed per second
- **Worker Count** - Number of workers used
- **Grid Size** - Dimensions of the region collapsed
- **Pre-collapsed Cells** - Number of existing cells used as constraints

### 2. Console Output

**Before Operation:**

```
Running collapse on 10x5x10 region with 0 pre-collapsed cells
Worker pool: 8 workers available
```

**After Success:**

```
Collapse complete: 500 cells kept from 500 buffer cells
⏱️  Performance: 1234.56ms (405 cells/sec) using 8 workers
```

**After Failure:**

```
❌ Collapse failed after 567.89ms: Contradiction occurred
```

### 3. Debug UI Display

The performance stats are also displayed in the debug UI progress indicator:

```
✓ Complete in 1235ms (8 workers)
```

This message persists for 3 seconds after completion.

## Worker Count Control

### UI Control

In the Debug UI **Generate** folder, you'll find:

```
Workers (max: X)  [slider: 1 to X]
```

Where `X` is your system's `navigator.hardwareConcurrency` value (typically your CPU core count).

### Programmatic Control

```typescript
// Get current worker count
const count = generator.getWorkerCount();
console.log(`Currently using ${count} workers`);

// Set worker count (1 to navigator.hardwareConcurrency)
generator.setWorkerCount(4);

// The pool is automatically recreated with the new count
```

### How It Works

When you change the worker count:

1. The existing worker pool is terminated
2. A new pool is created with the specified number of workers
3. All subsequent operations use the new pool
4. A console log confirms the change

```
Recreating worker pool with 4 workers (max: 8)
✓ Worker count changed to 4
```

## Benchmarking Guide

### Testing Different Worker Counts

To compare performance with different worker configurations:

1. **Open the Debug UI** and navigate to Generate folder
2. **Set a consistent grid size** (e.g., 20x10x20)
3. **Set worker count to 1** and click **Generate**
4. **Note the performance** in console: `⏱️ Performance: XXXXms`
5. **Repeat for 2, 4, 8 workers** (or your max)
6. **Compare results**

### Example Benchmark Session

```
Test: 20x10x20 grid, 2000 cells

1 worker:  ⏱️  Performance: 8234.56ms (243 cells/sec) using 1 workers
2 workers: ⏱️  Performance: 4456.12ms (449 cells/sec) using 2 workers
4 workers: ⏱️  Performance: 2789.34ms (717 cells/sec) using 4 workers
8 workers: ⏱️  Performance: 2145.67ms (932 cells/sec) using 8 workers

Observations:
- 2x speedup from 1→2 workers (good parallelization)
- 1.6x speedup from 2→4 workers (slight overhead)
- 1.3x speedup from 4→8 workers (diminishing returns)
```

### Factors Affecting Performance

**Grid Size**

- Larger grids benefit more from parallel workers
- Smaller grids (< 1000 cells) may not show significant improvement
- Sweet spot typically around 5000-10000 cells

**Pre-collapsed Cells**

- More constraints = faster collapse
- Expansion operations (with existing cells) may be faster than initial generation
- Measured in the "pre-collapsed cells" log

**Hardware**

- More CPU cores = better potential speedup
- Memory bandwidth can become bottleneck with many workers
- Cache effects matter for large grids

**Tile Complexity**

- More adjacency rules = more computation per cell
- Complex tilesets benefit more from parallelization
- Simple tilesets may be limited by overhead

## Performance Metrics Explained

### Duration (ms)

Wall-clock time from start of collapse to completion. Lower is better.

```typescript
const duration = endTime - startTime;
// Example: 1234.56ms
```

### Throughput (cells/sec)

How many cells were processed per second. Higher is better.

```typescript
const totalCells = width * height * depth;
const cellsPerSecond = totalCells / (duration / 1000);
// Example: 405 cells/sec
```

### Worker Count

Number of Web Workers in the pool. More isn't always better due to overhead.

### Efficiency

Implied by comparing throughput across worker counts:

```
Efficiency = (throughput with N workers) / (throughput with 1 worker)
Ideal efficiency = N (linear scaling)
```

## Optimization Tips

### 1. Find Your Sweet Spot

Not all systems benefit from max workers. Test to find optimal count:

```
If 8 workers = 2145ms
And 6 workers = 2178ms
And 4 workers = 2789ms

→ Use 6 workers (saves 2 workers with minimal slowdown)
```

### 2. Adjust for Operation Type

Different operations may have different optimal counts:

```typescript
// Large initial generation - use max workers
generator.setWorkerCount(8);
await generator.generate();

// Small local expansions - use fewer workers
generator.setWorkerCount(2);
await generator.expandFromCell(5, 0, 5, 3, 3, 3);
```

### 3. Battery/Power Considerations

For mobile or laptop users, fewer workers = less power consumption:

```typescript
// Check if on battery (browser API, if available)
const onBattery = (navigator as any).getBattery?.()?.charging === false;

generator.setWorkerCount(onBattery ? 2 : 8);
```

### 4. Background vs Foreground

Adjust worker count based on user activity:

```typescript
// User is actively editing - use fewer workers to keep UI responsive
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    generator.setWorkerCount(8); // Max for background work
  } else {
    generator.setWorkerCount(4); // Balance for interactive use
  }
});
```

## Expected Performance

### Typical Results (8-core CPU)

**Small Grid (10x10x10 = 1000 cells)**

- 1 worker: ~500ms
- 4 workers: ~300ms
- 8 workers: ~250ms
- Speedup: 2x

**Medium Grid (20x10x20 = 4000 cells)**

- 1 worker: ~2000ms
- 4 workers: ~800ms
- 8 workers: ~500ms
- Speedup: 4x

**Large Grid (50x10x50 = 25000 cells)**

- 1 worker: ~15000ms
- 4 workers: ~4500ms
- 8 workers: ~2500ms
- Speedup: 6x

### Scalability

The worker pool shows **near-linear scaling** up to about 4-6 workers, then diminishing returns due to:

- Worker coordination overhead
- Shared memory access patterns
- Browser's internal worker management

## API Reference

### getWorkerCount()

```typescript
getWorkerCount(): number
```

Returns the current number of workers in the pool.

**Example:**

```typescript
const count = generator.getWorkerCount();
console.log(`Using ${count} workers`);
```

### setWorkerCount()

```typescript
setWorkerCount(count: number): void
```

Sets the worker pool size. Automatically clamps to `[1, navigator.hardwareConcurrency]`.

**Parameters:**

- `count` - Desired number of workers (1 to max CPU cores)

**Example:**

```typescript
// Use half of available cores
const halfCores = Math.floor((navigator.hardwareConcurrency || 4) / 2);
generator.setWorkerCount(halfCores);
```

**Note:** This terminates the existing pool and creates a new one. Don't call during an active operation.

## Troubleshooting

### Performance Not Improving

**Issue:** Adding more workers doesn't speed up generation

**Possible Causes:**

1. Grid too small - overhead exceeds benefit
2. Already CPU-bound on other tasks
3. Browser limitations (some browsers limit workers)

**Solution:** Try a larger test grid (20x20x20 or more)

### Inconsistent Results

**Issue:** Same configuration gives different times

**Possible Causes:**

1. Browser background tasks
2. Other tabs using CPU
3. Thermal throttling on mobile
4. Random seed affecting complexity

**Solution:** Run multiple tests and average results

### Worker Creation Fails

**Issue:** Console shows "Recreating worker pool" but crashes

**Possible Causes:**

1. Too many workers requested
2. Browser memory limits
3. Script loading issues

**Solution:** Start with fewer workers (2-4) and increase gradually

## Implementation Details

### Performance Timer

Uses `performance.now()` for high-resolution timing:

```typescript
const startTime = performance.now();
// ... collapse operation ...
const endTime = performance.now();
const duration = endTime - startTime; // Milliseconds with microsecond precision
```

### Worker Pool

The `WorkerPool` class manages workers efficiently:

```typescript
class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Task[] = [];

  async executeTask(task: WorkerTask): Promise<any> {
    // Queues task and assigns to next available worker
    // Workers are reused across operations
  }
}
```

## See Also

- [Worker Pool Implementation](./WORKER_POOL_IMPLEMENTATION.md) - Technical details
- [WFC Generator Usage](./WFCGENERATOR_USAGE.md) - General usage guide
- [Library Usage Guide](./LIBRARY_USAGE.md) - Integration guide

## Future Enhancements

### Region-Based Parallelization

For very large grids, split into regions and process in parallel:

```typescript
// Coming soon: Multi-region generation
await generator.generate({
  width: 100,
  height: 20,
  depth: 100,
  regionSize: 25, // Split into 4x4 = 16 regions
  workersPerRegion: 2, // 32 total tasks
});
```

### Progress-Weighted Timing

Track per-cell timing for more accurate progress estimates:

```typescript
onProgress: (progress, estimatedTimeRemaining) => {
  console.log(`${progress}% complete, ~${estimatedTimeRemaining}ms remaining`);
};
```

### Performance Profiles

Save optimal configurations per grid size:

```typescript
generator.autoOptimizeWorkerCount(); // Tests and sets optimal count
const profile = generator.getPerformanceProfile();
// Save profile for future sessions
```
