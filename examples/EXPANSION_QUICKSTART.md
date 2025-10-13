# Quick Start: Expansion & Multi-Worker

## 1. Basic Expansion Example

```typescript
import { WFC3D, WFCTile3D } from "three-collapse";

// Define your tiles
const tiles = [
  new WFCTile3D({
    id: "grass",
    weight: 10,
    adjacency: {
      up: ["air", "grass"],
      down: ["dirt", "stone"],
      north: ["grass", "dirt"],
      south: ["grass", "dirt"],
      east: ["grass", "dirt"],
      west: ["grass", "dirt"],
    },
  }),
  new WFCTile3D({
    id: "air",
    weight: 5,
    adjacency: {
      up: ["air"],
      down: ["grass", "dirt", "stone"],
      north: ["air", "grass"],
      south: ["air", "grass"],
      east: ["air", "grass"],
      west: ["air", "grass"],
    },
  }),
  // ... more tiles
];

// Generate initial 10×10×10 grid
const wfc = new WFC3D({
  width: 10,
  height: 10,
  depth: 10,
  tiles,
  seed: 12345,
});

console.log("Generating initial grid...");
const success = await wfc.generate((progress) => {
  console.log(`${(progress * 100).toFixed(0)}%`);
});

if (success) {
  console.log("Initial generation complete!");

  // Expand by 5 cells in X and Z directions
  console.log("Expanding grid...");
  const expandSuccess = await wfc.expand(
    {
      xMin: 0,
      xMax: 5, // Add 5 cells to the right
      yMin: 0,
      yMax: 0,
      zMin: 0,
      zMax: 5, // Add 5 cells forward
    },
    (progress) => {
      console.log(`Expansion: ${(progress * 100).toFixed(0)}%`);
    }
  );

  if (expandSuccess) {
    console.log("Expansion complete! Grid is now 15×10×15");
  }
}
```

## 2. Auto-Expansion Pattern

```typescript
class ProceduralWorld {
  wfc: WFC3D;
  currentSize: { width: number; height: number; depth: number };

  async initialize() {
    this.wfc = new WFC3D({
      width: 10,
      height: 10,
      depth: 10,
      tiles: myTiles,
    });

    await this.wfc.generate();
    this.currentSize = { width: 10, height: 10, depth: 10 };
  }

  async expandToSize(newWidth: number, newHeight: number, newDepth: number) {
    const expansions = {
      xMin: 0,
      xMax: Math.max(0, newWidth - this.currentSize.width),
      yMin: 0,
      yMax: Math.max(0, newHeight - this.currentSize.height),
      zMin: 0,
      zMax: Math.max(0, newDepth - this.currentSize.depth),
    };

    // Only expand if dimensions increased
    const totalExpansion = expansions.xMax + expansions.yMax + expansions.zMax;
    if (totalExpansion > 0) {
      const success = await this.wfc.expand(expansions);
      if (success) {
        this.currentSize = {
          width: newWidth,
          height: newHeight,
          depth: newDepth,
        };
        return true;
      }
    }
    return false;
  }
}

// Usage
const world = new ProceduralWorld();
await world.initialize();

// Player moved near edge - expand world
await world.expandToSize(15, 10, 15);
await world.expandToSize(20, 10, 20);
```

## 3. Multi-Worker Generation

```typescript
import {
  WorkerPool,
  generateWithWorkers,
  prepareTilesForWorker,
} from "three-collapse";

// Create worker pool with all CPU cores
const pool = new WorkerPool(true);

console.log(`Using ${pool.getWorkerCount()} workers`);

// Generate large grid using multiple workers
const grid = await generateWithWorkers(
  40, // width
  20, // height
  40, // depth
  myTiles,
  pool,
  12345, // seed
  (progress) => {
    console.log(`Progress: ${(progress * 100).toFixed(0)}%`);
  }
);

console.log("Multi-worker generation complete!");

// Don't forget to clean up
pool.terminate();
```

## 4. Mixed Approach: Single Worker with Expansion

```typescript
import { WorkerPool } from "three-collapse";

class WFCManager {
  pool: WorkerPool;
  worker: Worker;
  currentBuffer: any = null;

  constructor() {
    // Single worker for consistency
    this.worker = new Worker(new URL("../src/wfc.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  async generate(width: number, height: number, depth: number) {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        if (e.data.type === "complete") {
          if (e.data.success) {
            // Store result for future expansion
            this.currentBuffer = this.serializeGrid(e.data.data);
            resolve(e.data.data);
          } else {
            reject(new Error("Generation failed"));
          }
        }
      };

      this.worker.postMessage({
        type: "generate",
        width,
        height,
        depth,
        tiles: prepareTilesForWorker(myTiles),
        seed: Date.now(),
      });
    });
  }

  async expand(expansions: any) {
    if (!this.currentBuffer) {
      throw new Error("No existing buffer to expand");
    }

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        if (e.data.type === "complete") {
          if (e.data.success) {
            this.currentBuffer = this.serializeGrid(e.data.data);
            resolve(e.data.data);
          } else {
            reject(new Error("Expansion failed"));
          }
        }
      };

      this.worker.postMessage({
        type: "expand",
        existingBuffer: this.currentBuffer,
        expansions,
        tiles: prepareTilesForWorker(myTiles),
        seed: Date.now(),
      });
    });
  }

  serializeGrid(grid: string[][][]) {
    // Convert grid to buffer format
    const cellData = [];
    for (let x = 0; x < grid.length; x++) {
      for (let y = 0; y < grid[x].length; y++) {
        for (let z = 0; z < grid[x][y].length; z++) {
          cellData.push({
            x,
            y,
            z,
            collapsed: true,
            tileId: grid[x][y][z],
            possibleTiles: [grid[x][y][z]],
          });
        }
      }
    }
    return {
      width: grid.length,
      height: grid[0].length,
      depth: grid[0][0].length,
      cellData,
    };
  }
}

// Usage
const manager = new WFCManager();
const initial = await manager.generate(10, 10, 10);
console.log("Initial grid generated");

const expanded = await manager.expand({
  xMin: 0,
  xMax: 5,
  yMin: 0,
  yMax: 0,
  zMin: 0,
  zMax: 5,
});
console.log("Grid expanded!");
```

## 5. Demo UI Integration

See `examples/models/demo.ts` for a complete example with:

- Auto-expansion checkbox
- Real-time slider updates triggering expansion
- Worker pool configuration
- Progress tracking UI

Key features:

```typescript
// Enable auto-expansion mode
this.expansionMode = true;

// When slider changes
private onGridSizeChange(): void {
  if (this.expansionMode && canExpand()) {
    const canAutoExpand =
      this.width >= this.previousWidth &&
      this.height >= this.previousHeight &&
      this.depth >= this.previousDepth;

    if (canAutoExpand) {
      setTimeout(() => this.generate(true), 500);
    }
  }
}
```

## Tips & Best Practices

### 1. Always Check for Contradictions

```typescript
const success = await wfc.expand(expansions);
if (!success) {
  console.error("Expansion failed - try adjusting adjacency rules");
  // Fallback: regenerate from scratch
}
```

### 2. Debounce Rapid Changes

```typescript
let expansionTimeout;
function onSliderChange() {
  clearTimeout(expansionTimeout);
  expansionTimeout = setTimeout(() => {
    triggerExpansion();
  }, 500);
}
```

### 3. Limit Expansion Size

```typescript
const MAX_EXPANSION = 10;
expansions.xMax = Math.min(expansions.xMax, MAX_EXPANSION);
```

### 4. Clean Up Workers

```typescript
// In component cleanup/unmount
if (this.pool) {
  this.pool.terminate();
}
if (this.worker) {
  this.worker.terminate();
}
```

### 5. Monitor Performance

```typescript
const start = performance.now();
await wfc.expand(expansions);
const duration = performance.now() - start;
console.log(`Expansion took ${duration.toFixed(0)}ms`);
```

## Common Patterns

### Infinite World Generation

Expand grid as player approaches edges:

```typescript
function checkPlayerPosition(playerX, playerZ, worldSize) {
  const buffer = 5; // Cells from edge

  if (playerX > worldSize.width - buffer) {
    await expandWorld({ xMax: 10 });
  }
  if (playerZ > worldSize.depth - buffer) {
    await expandWorld({ zMax: 10 });
  }
}
```

### LOD-Style Generation

Generate high detail near player:

```typescript
// Coarse initial grid
await wfc.generate(); // 20×20×20

// Expand specific region with different tileset
await wfc.expand({
  xMin: 5,
  xMax: 5,
  yMin: 0,
  yMax: 0,
  zMin: 5,
  zMax: 5,
});
```

### Multi-Phase Generation

Generate in stages:

```typescript
// Phase 1: Terrain
await generateTerrain(10, 10, 10);

// Phase 2: Expand upward for structures
await expandUpward({ yMax: 10 });

// Phase 3: Expand outward for context
await expandOutward({ xMax: 5, zMax: 5 });
```
