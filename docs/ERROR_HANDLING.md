# Error Handling & Recovery in WFC

This document explains the error handling, retry mechanisms, and tileset validation features in three-collapse.

## Detailed Error Reporting

### Error Types

WFC can fail in three main ways:

1. **`contradiction`**: No valid cells to collapse (all remaining cells have zero entropy)
2. **`no_valid_tile`**: Couldn't select a tile for a specific cell
3. **`propagation_failed`**: Constraint propagation created contradictions in neighboring cells

### Error Information

Each error includes:

```typescript
interface WFC3DError {
  type: "contradiction" | "no_valid_tile" | "propagation_failed";
  message: string; // Human-readable description
  location?: { x; y; z }; // Where the error occurred
  progress?: number; // Percentage complete (0-1)
  cellsCollapsed?: number; // Cells successfully collapsed
  totalCells?: number; // Total grid size
  details?: string; // Additional context
}
```

### Accessing Error Details

**After generation:**

```typescript
const wfc = new WFC3D({ width, height, depth, tiles });
const success = await wfc.generate();

if (!success && wfc.lastError) {
  console.log("Error type:", wfc.lastError.type);
  console.log("Failed at:", wfc.lastError.location);
  console.log("Progress:", (wfc.lastError.progress * 100).toFixed(1) + "%");
  console.log("Details:", wfc.lastError.details);
}
```

**In worker messages:**

```typescript
worker.onmessage = (e) => {
  if (e.data.type === "error" && e.data.error) {
    console.log("WFC Error:", e.data.error);
    // Access all error properties
  }
};
```

## Automatic Retry Mechanism

The demo automatically retries failed generations with different random seeds.

### How It Works

1. **Initial attempt**: Uses your specified seed
2. **On failure**: If a WFC contradiction occurs, automatically retry
3. **New seed**: Each retry uses a different seed (`Date.now() + attemptNumber`)
4. **Progress indicator**: Shows "Attempt X/Y" in the status text
5. **Visual feedback**: Progress bar turns orange during retries
6. **Max retries**: Defaults to 3 attempts

### Configuration

```typescript
// In examples/models/generate.ts
await generate(
  modelDemo,
  tiles,
  false, // isExpansion
  3 // maxRetries (default)
);
```

### Retry Behavior

- **Successful retry**: Displays result normally
- **All retries fail**: Shows detailed error with final attempt info
- **User feedback**: "Failed after 3 attempts: [error message]"

## Tileset Validation

Validate your tileset **before** generation to catch potential issues.

### Basic Validation

```typescript
import { validateTileset } from "three-collapse";

const validation = validateTileset(tiles);

if (!validation.valid) {
  console.error("Tileset has errors!");
  for (const issue of validation.issues) {
    console.log(`${issue.severity}: ${issue.message}`);
  }
}

// Show suggestions
for (const suggestion of validation.suggestions) {
  console.log(suggestion);
}
```

### Validation Checks

The validator checks for:

1. **Missing adjacency rules**: Tiles with no neighbor constraints
2. **Asymmetric adjacency**: Tile A allows B, but B doesn't allow A back
3. **Isolated tiles**: Tiles with empty adjacency lists (will always fail)
4. **Unreachable tiles**: Tiles that can't be reached from others

### Example Output

```
⚠️ Tileset validation found issues:
❌ Tile 'base' has empty adjacency list in up direction (no tiles can be placed there)
⚠️ Asymmetric adjacency: 'block' allows 'base' in down, but 'base' doesn't allow 'block' in opposite direction

💡 Suggestions:
- Tiles with empty adjacency lists will cause contradictions - ensure all tiles can have neighbors in all directions
- Consider making adjacency rules symmetric to reduce contradictions
```

### Validation in Demo

The demo automatically validates on startup:

```typescript
constructor() {
  this.tiles = mixedModelTileset;

  // Automatic validation
  const validation = validateTileset(this.tiles);
  if (!validation.valid) {
    console.warn("⚠️ Tileset validation found issues:");
    // ... show issues
  }
}
```

## Common Causes & Solutions

### 1. Propagation Failed at Y=0 with "base" tile

**Symptom:** Fails when placing "base" at bottom layer

```
Constraint propagation failed after collapsing cell (13, 0, 6) to 'base'
```

**Possible Causes:**

- `base` tile has no valid neighbors in some direction
- Asymmetric adjacency rules between `base` and other tiles
- `base` tile's `up` adjacency is too restrictive

**Solutions:**

```typescript
// Check base tile adjacency
const baseTile = {
  id: "base",
  adjacency: {
    up: ["block", "empty", "air"], // Add all valid tiles above base
    down: [], // Nothing below ground
    north: ["base", "empty"], // Can be next to itself
    south: ["base", "empty"],
    east: ["base", "empty"],
    west: ["base", "empty"],
  },
};

// Ensure symmetric rules
const blockTile = {
  id: "block",
  adjacency: {
    down: ["base", "block"], // IMPORTANT: Must include 'base' if base.up includes 'block'
    // ... other directions
  },
};
```

### 2. High Failure Rate (96%+ complete)

**Symptom:** Consistently fails near end of generation

```
progress: 0.9686 (96.86% complete)
```

**Cause:** Tile weights or adjacency create "dead ends"

**Solutions:**

1. **Increase tile variety**: Add more transition tiles
2. **Adjust weights**: Give common/flexible tiles higher weights
3. **Relax constraints**: Allow more adjacency combinations
4. **Use symmetric rules**: Ensure if A→B then B→A

```typescript
// Bad: Only specific combinations allowed
{
  id: "special",
  weight: 0.5,  // Low weight
  adjacency: {
    up: ["rare"],      // Only one option
    down: ["specific"] // Dead end!
  }
}

// Good: Flexible tile
{
  id: "common",
  weight: 5.0,  // Higher weight
  adjacency: {
    up: ["common", "special", "rare"],     // Multiple options
    down: ["common", "special", "ground"], // Always has choices
    // ... same for all directions
  }
}
```

### 3. Expansion Failures

**Symptom:** Initial generation works, but expansion fails

```
Edge constraint propagation created contradiction at (5, 8, 3)
```

**Cause:** Existing tiles incompatible with expansion tiles

**Solutions:**

1. **Check edge compatibility**: Ensure expanded tiles can connect
2. **Use "air" tiles**: Add flexible boundary tiles
3. **Symmetric rules**: Expansion relies heavily on symmetry

```typescript
// Add flexible boundary tile
{
  id: "air",
  weight: 10.0,  // High weight for easy expansion
  adjacency: {
    up: ["air"],
    down: ["air", "base", "block"],  // Can sit on anything
    north: ["air", "base", "block"], // Can be next to anything
    south: ["air", "base", "block"],
    east: ["air", "base", "block"],
    west: ["air", "base", "block"],
  }
}
```

## Best Practices

### 1. Always Validate First

```typescript
// Before generating
const validation = validateTileset(myTiles);
if (!validation.valid) {
  console.error("Fix these issues first:", validation.issues);
  return;
}

// Then generate
const wfc = new WFC3D({ width, height, depth, tiles: myTiles });
await wfc.generate();
```

### 2. Use Symmetric Adjacency Rules

```typescript
// If tile A allows B on the right...
tileA.adjacency.east = ["B"];

// Then tile B should allow A on the left
tileB.adjacency.west = ["A"];
```

### 3. Provide Fallback Tiles

Always include flexible "connector" tiles:

- `air` or `empty` tiles that work everywhere
- Transition tiles between different regions
- Ground/base tiles with high weights

### 4. Test with Small Grids First

```typescript
// Start small
const wfc = new WFC3D({
  width: 5,
  height: 5,
  depth: 5,
  tiles,
});

// If it works consistently, scale up
```

### 5. Monitor Error Patterns

```typescript
let errorCounts = {
  contradiction: 0,
  no_valid_tile: 0,
  propagation_failed: 0,
};

// Track patterns
if (!success && wfc.lastError) {
  errorCounts[wfc.lastError.type]++;

  // If propagation_failed is common, check adjacency rules
  // If contradiction is common, increase tile variety
}
```

## Advanced: Manual Retry Logic

If you need custom retry behavior:

```typescript
async function generateWithCustomRetry(options) {
  const maxAttempts = 5;
  const seeds = [12345, 67890, 11111, 22222, 33333];

  for (let i = 0; i < maxAttempts; i++) {
    const wfc = new WFC3D({
      ...options,
      seed: seeds[i],
    });

    const success = await wfc.generate();

    if (success) {
      return { success: true, wfc };
    }

    // Analyze failure
    if (wfc.lastError) {
      console.log(`Attempt ${i + 1} failed:`, wfc.lastError.type);

      // Custom logic based on error type
      if (wfc.lastError.type === "isolated_tile") {
        // This won't be fixed by retrying
        return { success: false, error: wfc.lastError };
      }
    }
  }

  return { success: false, error: "Max retries exceeded" };
}
```

## Debugging Tips

### 1. Log Error Location

```typescript
if (wfc.lastError?.location) {
  const { x, y, z } = wfc.lastError.location;
  console.log(`Failed at cell (${x}, ${y}, ${z})`);

  // Check what tiles were nearby
  const neighbors = [];
  // ... check buffer state around this location
}
```

### 2. Visualize Compatibility Matrix

```typescript
import { getCompatibilityMatrix } from "three-collapse";

const matrix = getCompatibilityMatrix(tiles);

for (const [tileId, compatible] of matrix.entries()) {
  console.log(`${tileId} can be adjacent to:`, Array.from(compatible.keys()));
}
```

### 3. Progressive Testing

```typescript
// Test with subsets
const coreTiles = tiles.filter((t) => ["base", "air"].includes(t.id));
const extendedTiles = [...coreTiles, blockTile];
const fullTileset = extendedTiles;

// Test each set
await testTileset(coreTiles); // Should always work
await testTileset(extendedTiles); // Add complexity
await testTileset(fullTileset); // Full test
```

## Summary

✅ **Error reporting**: Detailed info on what, where, and why failures occur
✅ **Auto-retry**: 3 automatic retries with different seeds
✅ **Validation**: Catch issues before generation starts  
✅ **Debugging tools**: Compatibility matrices and suggestions
✅ **Best practices**: Symmetric rules, flexible tiles, progressive testing

With these tools, you can diagnose and fix tileset issues systematically!
