# WFCGenerator - Main Entry Point

The `WFCGenerator` class is the primary interface for using three-collapse. It handles all worker management, retry logic, expansion, and real-time tile updates automatically.

## Quick Start

```typescript
import { WFCGenerator } from "three-collapse";
import { myTileset } from "./tileset";

// Create a generator
const generator = new WFCGenerator(myTileset, {
  workerCount: 4,
  maxRetries: 3,
  autoExpansion: true,
  seed: 12345,
});

// Generate a grid
const grid = await generator.generate(20, 10, 20, {
  onProgress: (progress) => {
    console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
  },
  onTileUpdate: (x, y, z, tileId) => {
    // Update your renderer in real-time
    renderer.updateTile(x, y, z, tileId);
  },
});

// Clean up when done
generator.dispose();
```

## Constructor

```typescript
new WFCGenerator(tiles: WFCTile3DConfig[], options?: WFCGeneratorOptions)
```

### Options

```typescript
interface WFCGeneratorOptions {
  /** Number of workers to use (default: hardware concurrency) */
  workerCount?: number;

  /** Maximum number of retry attempts on failure (default: 3) */
  maxRetries?: number;

  /** Enable automatic expansion mode (default: false) */
  autoExpansion?: boolean;

  /** Random seed for generation */
  seed?: number;
}
```

## Methods

### `generate()`

Generate a new WFC grid.

```typescript
async generate(
  width: number,
  height: number,
  depth: number,
  options?: GenerateOptions
): Promise<string[][][]>
```

#### Generate Options

```typescript
interface GenerateOptions {
  /** Override the seed for this generation */
  seed?: number;

  /** Callback for progress updates (0.0 to 1.0) */
  onProgress?: (progress: number) => void;

  /** Callback for individual tile updates */
  onTileUpdate?: (x: number, y: number, z: number, tileId: string) => void;
}
```

#### Example

```typescript
const grid = await generator.generate(30, 10, 30, {
  onProgress: (progress) => {
    progressBar.update(progress);
  },
  onTileUpdate: (x, y, z, tileId) => {
    scene.addTile(x, y, z, tileId);
  },
});
```

### `expand()`

Expand an existing grid. Requires `autoExpansion: true` in constructor options.

```typescript
async expand(
  newWidth: number,
  newHeight: number,
  newDepth: number,
  options?: ExpandOptions
): Promise<string[][][]>
```

#### Example

```typescript
// Generate initial grid
await generator.generate(10, 10, 10);

// Expand it later
const expandedGrid = await generator.expand(20, 10, 20, {
  onTileUpdate: (x, y, z, tileId) => {
    scene.addTile(x, y, z, tileId);
  },
});
```

### `shrink()`

Shrink an existing grid by removing tiles.

```typescript
shrink(
  newWidth: number,
  newHeight: number,
  newDepth: number
): string[][][]
```

#### Example

```typescript
const shrunkGrid = generator.shrink(5, 10, 5);
renderer.updateGrid(shrunkGrid);
```

### `canExpand()`

Check if expansion is possible.

```typescript
canExpand(): boolean
```

### `reset()`

Reset the generator state (clears expansion data).

```typescript
reset(): void
```

### `setTiles()`

Update the tileset.

```typescript
setTiles(tiles: WFCTile3DConfig[]): void
```

**Note:** This also resets expansion state.

### `setSeed()`

Update the random seed.

```typescript
setSeed(seed: number): void
```

### `getSeed()`

Get the current seed.

```typescript
getSeed(): number
```

### `getLastGrid()`

Get the last generated grid.

```typescript
getLastGrid(): string[][][] | null
```

### `dispose()`

Clean up workers and free resources.

```typescript
dispose(): void
```

**Important:** Always call `dispose()` when you're done to prevent memory leaks.

## Complete Example with Three.js

```typescript
import * as THREE from "three";
import {
  WFCGenerator,
  InstancedModelRenderer,
  GLBTileLoader,
} from "three-collapse";
import { myTileset } from "./tileset";

class WFCDemo {
  private generator: WFCGenerator;
  private renderer: InstancedModelRenderer;
  private scene: THREE.Scene;

  async init() {
    // Create scene
    this.scene = new THREE.Scene();

    // Load GLB models
    const loader = new GLBTileLoader();
    const modelData = await loader.loadTileset(myTileset);

    // Create instanced renderer
    this.renderer = new InstancedModelRenderer(
      this.scene,
      modelData,
      1.0 // cell size
    );

    // Create WFC generator
    this.generator = new WFCGenerator(myTileset, {
      workerCount: 4,
      maxRetries: 3,
      autoExpansion: true,
      seed: Date.now(),
    });

    // Generate with real-time updates
    await this.generate(20, 10, 20);
  }

  async generate(width: number, height: number, depth: number) {
    // Center the grid
    this.renderer.setOffset(-width / 2, -height / 2, -depth / 2);

    // Generate with callbacks
    const grid = await this.generator.generate(width, height, depth, {
      onProgress: (progress) => {
        console.log(`Generation: ${(progress * 100).toFixed(1)}%`);
      },
      onTileUpdate: (x, y, z, tileId) => {
        // Filter out air tiles
        if (tileId && tileId !== "air") {
          // Get the full grid and update
          const fullGrid = this.generator.getLastGrid();
          if (fullGrid) {
            this.renderer.updateGrid(fullGrid);
          }
        }
      },
    });

    console.log("Generation complete!", grid);
  }

  dispose() {
    this.generator.dispose();
    this.renderer.dispose();
  }
}

// Usage
const demo = new WFCDemo();
await demo.init();

// Later, clean up
demo.dispose();
```

## Error Handling

The generator handles retries automatically. If all retries fail, it throws an error:

```typescript
try {
  const grid = await generator.generate(width, height, depth);
} catch (error) {
  console.error("Generation failed:", error.message);

  // You can use the static method to format WFC errors
  if (error.wfcError) {
    const formatted = WFCGenerator.formatError(error.wfcError);
    console.error(formatted);
  }
}
```

## Advanced: Automatic Retry with Different Seeds

The generator automatically retries with incremented seeds:

```typescript
const generator = new WFCGenerator(tiles, {
  maxRetries: 5, // Will try 5 times with different seeds
  seed: 12345,
});

// If first attempt fails, it tries with seed 12346, 12347, etc.
const grid = await generator.generate(width, height, depth);
```

## Performance Tips

### 1. Worker Count

```typescript
// Use all available cores
const generator = new WFCGenerator(tiles, {
  workerCount: navigator.hardwareConcurrency,
});

// Or limit for better responsiveness
const generator = new WFCGenerator(tiles, {
  workerCount: 4,
});
```

### 2. Batched Tile Updates

For better performance, batch your tile updates:

```typescript
let updateScheduled = false;
const pendingUpdates = new Map();

const generator = new WFCGenerator(tiles, {
  autoExpansion: true,
});

await generator.generate(width, height, depth, {
  onTileUpdate: (x, y, z, tileId) => {
    // Store update
    pendingUpdates.set(`${x},${y},${z}`, { x, y, z, tileId });

    // Schedule batch update
    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(() => {
        // Apply all pending updates at once
        for (const update of pendingUpdates.values()) {
          renderer.updateTile(update.x, update.y, update.z, update.tileId);
        }
        pendingUpdates.clear();
        updateScheduled = false;
      });
    }
  },
});
```

### 3. Progressive Rendering Strategy

```typescript
let updateCount = 0;
const BATCH_SIZE = 50; // Update renderer every N tiles

await generator.generate(width, height, depth, {
  onTileUpdate: (x, y, z, tileId) => {
    updateCount++;

    // Only update renderer periodically
    if (updateCount % BATCH_SIZE === 0) {
      const grid = generator.getLastGrid();
      if (grid) {
        renderer.updateGrid(grid);
      }
    }
  },
});

// Final update
renderer.updateGrid(generator.getLastGrid()!);
```

## Migration from Old API

### Before (using WorkerPool and generate functions directly)

```typescript
import { WorkerPool, generateWithWorkers } from "three-collapse";

const workerPool = new WorkerPool(4);
const grid = await generateWithWorkers(
  width,
  height,
  depth,
  tiles,
  workerPool,
  seed
);
workerPool.terminate();
```

### After (using WFCGenerator)

```typescript
import { WFCGenerator } from "three-collapse";

const generator = new WFCGenerator(tiles, {
  workerCount: 4,
  seed: seed,
});
const grid = await generator.generate(width, height, depth);
generator.dispose();
```

## Benefits

- ✅ **Automatic Worker Management**: No need to manually create/terminate workers
- ✅ **Built-in Retry Logic**: Automatically retries with different seeds on failure
- ✅ **Expansion Support**: Easy grid expansion with state management
- ✅ **Real-time Updates**: Progressive rendering with tile update callbacks
- ✅ **Clean API**: Single class handles everything
- ✅ **Resource Management**: Proper cleanup with `dispose()`
- ✅ **Type Safety**: Full TypeScript support with comprehensive types

## API Reference Summary

| Method                 | Description                 | Returns                 |
| ---------------------- | --------------------------- | ----------------------- |
| `generate()`           | Generate new grid           | `Promise<string[][][]>` |
| `expand()`             | Expand existing grid        | `Promise<string[][][]>` |
| `shrink()`             | Shrink existing grid        | `string[][][]`          |
| `canExpand()`          | Check if expansion possible | `boolean`               |
| `reset()`              | Clear expansion state       | `void`                  |
| `setTiles()`           | Update tileset              | `void`                  |
| `setSeed()`            | Update seed                 | `void`                  |
| `getSeed()`            | Get current seed            | `number`                |
| `getLastGrid()`        | Get last generated grid     | `string[][][] \| null`  |
| `dispose()`            | Clean up resources          | `void`                  |
| `static formatError()` | Format WFC error            | `string`                |
