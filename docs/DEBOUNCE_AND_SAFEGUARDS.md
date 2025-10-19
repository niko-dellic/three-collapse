# Debouncing and Renderer Safeguards

## Overview

This document describes the implementation of debouncing for dimension changes and renderer safeguards to prevent duplicate tile rendering.

## Problem 1: Too Many Expand Requests

### Issue

When users adjusted dimension sliders rapidly, each change triggered an immediate expand request, causing:

- Multiple simultaneous expand operations
- Race conditions
- Wasted computation
- Potential conflicts in the grid state

### Solution: Debounced Dimension Changes

Implemented a debouncing mechanism with safeguards in `debugUI.ts`:

```typescript
private dimensionChangeTimeout: ReturnType<typeof setTimeout> | null = null;
private isExpandInProgress: boolean = false;

private async handleDimensionChange(
  _dimension: "width" | "height" | "depth",
  _value: number
): Promise<void> {
  // Update UI immediately
  if (this.localExpansionControllers)
    this.localExpansionControllers.updateLimits();

  // Cancel any pending expand operation
  if (this.dimensionChangeTimeout) {
    clearTimeout(this.dimensionChangeTimeout);
    this.dimensionChangeTimeout = null;
  }

  // Debounce: wait 500ms after last change
  this.dimensionChangeTimeout = setTimeout(async () => {
    // Don't proceed if already expanding
    if (this.isExpandInProgress) {
      console.log("Expand already in progress, skipping");
      return;
    }

    try {
      this.isExpandInProgress = true;
      await this.generator.expand(width, height, depth);
    } finally {
      this.isExpandInProgress = false;
    }
  }, 500); // 500ms delay
}
```

### How It Works

1. **Immediate UI Update**: Local expansion slider limits update instantly
2. **Cancel Previous Timer**: Any pending expand operation is cancelled
3. **500ms Delay**: Wait for user to stop changing values
4. **In-Progress Check**: Prevent overlapping expand operations
5. **Safe Execution**: Always reset flag in `finally` block

### Benefits

- ✅ Only one expand operation at a time
- ✅ Waits for user to finish adjusting
- ✅ Prevents race conditions
- ✅ Reduces wasted computation
- ✅ Better user experience (less lag)

## Problem 2: Duplicate Tile Rendering

### Issue

During parallel worker execution, multiple workers could attempt to render tiles to the same position, causing:

- Multiple instances at the same location
- Visual artifacts (z-fighting)
- Memory waste
- Incorrect cell state

This was especially problematic at region boundaries where workers might have overlapping responsibilities.

### Solution: Position Tracking Safeguard

Added position tracking to `InstancedModelRenderer.ts`:

```typescript
// Track which tile is at each position
private renderedPositions: Map<string, string>; // key: "x,y,z", value: tileId

constructor(scene: THREE.Scene, cellSize: number = 1) {
  // ...
  this.renderedPositions = new Map();
}
```

### Safeguard Logic

```typescript
addTileInstance(tileId: string, x: number, y: number, z: number): void {
  const positionKey = this.coordToKey(x, y, z);

  // Check if tile already exists at this position
  const existingTileId = this.renderedPositions.get(positionKey);
  if (existingTileId) {
    if (existingTileId === tileId) {
      // Same tile - skip silently
      return;
    } else {
      // Different tile - warn and skip
      console.warn(
        `Attempted to render "${tileId}" at (${x},${y},${z}) ` +
        `but "${existingTileId}" already there. Skipping.`
      );
      return;
    }
  }

  // Track this position
  this.renderedPositions.set(positionKey, tileId);

  // ... proceed with rendering ...
}
```

### Cleanup

Updated `clear()` to reset position tracking:

```typescript
clear(): void {
  // ... dispose meshes ...
  this.instancedMeshes.clear();
  this.instanceData.clear();
  this.renderedPositions.clear(); // NEW: Clear position tracking
}
```

### How It Works

1. **Position Key**: Convert (x,y,z) to string key "x,y,z"
2. **Check Existing**: Look up if tile already at position
3. **Same Tile**: Skip silently (idempotent)
4. **Different Tile**: Log warning and skip (prevents conflict)
5. **Track Position**: Record tileId at position
6. **Cleanup**: Clear tracking when renderer clears

### Benefits

- ✅ Prevents duplicate tiles at same position
- ✅ Detects and logs conflicts (helpful for debugging)
- ✅ Idempotent (safe to call multiple times)
- ✅ No visual artifacts (z-fighting)
- ✅ Correct memory usage

## Testing

### Test Debouncing

1. **Open Debug UI** with dimension sliders
2. **Rapidly change width** slider (drag quickly)
3. **Observe console**: Should see only one expand after you stop
4. **Try changing during expand**: Should skip with "already in progress" message

Expected console output:

```
Auto-expanding to 15x10x15...
Expand already in progress, skipping dimension change
Expand already in progress, skipping dimension change
Auto-expand complete
```

### Test Renderer Safeguard

1. **Generate a grid** with multiple workers
2. **Check console** for warnings
3. **No warnings** = Good! No duplicates detected
4. **Warnings present** = Safeguard is working, preventing duplicates

If you see warnings like:

```
Attempted to render "block" at (5,0,5) but "ramp" already there. Skipping.
```

This means the safeguard caught and prevented a duplicate. This shouldn't happen with proper boundary collapse, but the safeguard catches it if it does.

## Files Modified

### `src/utils/debugUI.ts`

- Added `dimensionChangeTimeout` field
- Added `isExpandInProgress` flag
- Updated `handleDimensionChange()` with debouncing logic

### `src/renderers/InstancedModelRenderer.ts`

- Added `renderedPositions` map
- Updated `addTileInstance()` with position check
- Updated `clear()` to reset position tracking

## Performance Impact

### Debouncing

- **Positive**: Reduces unnecessary expand operations
- **Neutral**: 500ms delay barely noticeable to users
- **Net Result**: Better performance, less CPU usage

### Position Tracking

- **Memory**: O(n) where n = number of rendered cells
  - For 10,000 cells: ~240KB (24 bytes per entry)
- **CPU**: O(1) lookup per addTileInstance call
- **Net Result**: Negligible overhead, significant safety benefit

## Edge Cases Handled

### Debouncing Edge Cases

1. **User changes multiple dimensions rapidly**

   - ✅ Only last change triggers expand

2. **User changes dimension during expand**

   - ✅ Skipped with warning message

3. **Timer cancelled before firing**
   - ✅ Properly cleaned up with clearTimeout

### Renderer Edge Cases

1. **Same tile added twice to same position**

   - ✅ Skip silently (idempotent)

2. **Different tile added to occupied position**

   - ✅ Log warning and skip

3. **Clear() called during rendering**
   - ✅ Position map properly reset

## Future Enhancements

### Adaptive Debounce Delay

Adjust delay based on operation speed:

```typescript
// Shorter delay for small grids (fast operations)
// Longer delay for large grids (slow operations)
const delay = Math.min(500, totalCells / 10);
```

### Position Conflict Resolution

Instead of skipping, could implement strategies:

```typescript
enum ConflictStrategy {
  SKIP, // Current behavior
  REPLACE, // Replace old with new
  KEEP_FIRST, // Keep old, skip new (current)
  PRIORITY_BASED, // Based on tile type priority
}
```

### Batch Position Updates

For better performance during full re-renders:

```typescript
updatePositions(updates: Array<[x, y, z, tileId]>): void {
  // Batch update without individual checks
  // Useful when rebuilding entire grid
}
```

## Related Documentation

- [Parallel Cell Distribution](./PARALLEL_CELL_DISTRIBUTION.md) - Why boundaries matter
- [Worker Pool Implementation](./WORKER_POOL_IMPLEMENTATION.md) - Parallel processing
- [Performance Timing](./PERFORMANCE_TIMING.md) - Benchmarking guide
