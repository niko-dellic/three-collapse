# Library Usage Guide

This guide explains how to use `three-collapse` as an npm package in your own projects.

## Installation

### From npm (after publishing)

```bash
npm install three-collapse three
```

### From local directory (for testing)

```bash
# In the three-collapse directory
npm run build:lib
npm link

# In your project directory
npm link three-collapse
```

### From GitHub (before publishing to npm)

```bash
npm install git+https://github.com/yourusername/three-collapse.git
```

## Basic Usage

### Importing the Library

```typescript
import {
  WFC3D,
  WFCTile3D,
  VoxelTile3DConfig,
  ModelTile3DConfig,
  GLBTileLoader,
  InstancedModelRenderer,
} from "three-collapse";
```

## Example: Voxel-Based WFC

```typescript
import * as THREE from "three";
import { WFC3D, WFCTile3D, VoxelTile3DConfig } from "three-collapse";

// Define your tileset
const tiles: VoxelTile3DConfig[] = [
  {
    id: "grass",
    weight: 3,
    color: "#7CFC00",
    adjacency: {
      up: ["air"],
      down: ["dirt"],
      north: ["grass", "air"],
      south: ["grass", "air"],
      east: ["grass", "air"],
      west: ["grass", "air"],
    },
  },
  {
    id: "air",
    weight: 5,
    color: "#87CEEB",
    adjacency: {
      up: ["air"],
      down: ["air", "grass"],
      north: ["air", "grass"],
      south: ["air", "grass"],
      east: ["air", "grass"],
      west: ["air", "grass"],
    },
  },
];

// Create WFC tiles
const wfcTiles = tiles.map((config) => new WFCTile3D(config));

// Initialize WFC solver
const wfc = new WFC3D({
  width: 10,
  height: 8,
  depth: 10,
  tiles: wfcTiles,
  seed: Date.now(),
});

// Generate
const success = await wfc.generate((progress) => {
  console.log(`Progress: ${Math.round(progress * 100)}%`);
});

if (success) {
  // Access the collapsed grid
  for (let x = 0; x < wfc.buffer.width; x++) {
    for (let y = 0; y < wfc.buffer.height; y++) {
      for (let z = 0; z < wfc.buffer.depth; z++) {
        const tileId = wfc.buffer.getTileAt(x, y, z);

        if (tileId && tileId !== "air") {
          const tile = tiles.find((t) => t.id === tileId);

          // Render voxel
          const geometry = new THREE.BoxGeometry(1, 1, 1);
          const material = new THREE.MeshLambertMaterial({
            color: tile?.color,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, z);
          scene.add(mesh);
        }
      }
    }
  }
}
```

## Example: Model-Based WFC with Instanced Rendering

```typescript
import * as THREE from "three";
import {
  WFC3D,
  WFCTile3D,
  ModelTile3DConfig,
  GLBTileLoader,
  InstancedModelRenderer,
} from "three-collapse";

// Define model tileset
const modelTiles: ModelTile3DConfig[] = [
  {
    id: "block",
    weight: 2,
    filepath: "/models/block.glb",
    adjacency: {
      up: ["block", "air"],
      down: ["block", "base"],
      north: ["block", "air"],
      south: ["block", "air"],
      east: ["block", "air"],
      west: ["block", "air"],
    },
  },
  {
    id: "base",
    weight: 3,
    filepath: "/models/base.glb",
    adjacency: {
      up: ["block", "base"],
      down: ["base"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "air",
    weight: 8,
    filepath: "/models/empty.glb",
    adjacency: {
      up: ["air"],
      down: ["air", "block", "base"],
      north: ["air", "block", "base"],
      south: ["air", "block", "base"],
      east: ["air", "block", "base"],
      west: ["air", "block", "base"],
    },
  },
];

// Initialize Three.js scene
const scene = new THREE.Scene();

// Load GLB models
const loader = new GLBTileLoader();
const modelData = await loader.loadTileset(modelTiles);

// Create WFC instance
const wfcTiles = modelTiles.map((config) => new WFCTile3D(config));
const wfc = new WFC3D({
  width: 10,
  height: 8,
  depth: 10,
  tiles: wfcTiles,
  seed: Date.now(),
});

// Run generation
const success = await wfc.generate((progress) => {
  console.log(`Generation: ${Math.round(progress * 100)}%`);
});

if (success) {
  // Extract grid data
  const collapsedGrid: string[][][] = [];
  for (let x = 0; x < wfc.buffer.width; x++) {
    collapsedGrid[x] = [];
    for (let y = 0; y < wfc.buffer.height; y++) {
      collapsedGrid[x][y] = [];
      for (let z = 0; z < wfc.buffer.depth; z++) {
        const tileId = wfc.buffer.getTileAt(x, y, z) || "";
        collapsedGrid[x][y][z] = tileId;
      }
    }
  }

  // Render using instanced meshes
  const renderer = new InstancedModelRenderer(scene, modelData, 1);

  // Filter out 'air' tiles
  const filteredGrid = collapsedGrid.map((xLayer) =>
    xLayer.map((yLayer) =>
      yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
    )
  );

  renderer.render(filteredGrid);

  // Get rendering stats
  const stats = renderer.getStats();
  console.log(
    `Rendered ${stats.totalInstances} instances using ${stats.tileTypes} tile types`
  );
}
```

## Using with Web Workers

```typescript
// main.ts
const worker = new Worker(new URL("./wfc.worker.ts", import.meta.url), {
  type: "module",
});

worker.postMessage({
  type: "generate",
  width: 10,
  height: 8,
  depth: 10,
  tiles: tileConfigs,
  seed: Date.now(),
});

worker.onmessage = (e) => {
  if (e.data.type === "complete" && e.data.success) {
    const collapsedGrid = e.data.data;
    // Render the grid
  }
};

// wfc.worker.ts
import { WFC3D, WFCTile3D } from "three-collapse";

self.onmessage = async (e) => {
  const { width, height, depth, tiles, seed } = e.data;

  const wfcTiles = tiles.map((config: any) => new WFCTile3D(config));
  const wfc = new WFC3D({ width, height, depth, tiles: wfcTiles, seed });

  const success = await wfc.generate((progress) => {
    self.postMessage({ type: "progress", progress });
  });

  if (success) {
    // Extract grid data
    const data = [];
    for (let x = 0; x < width; x++) {
      data[x] = [];
      for (let y = 0; y < height; y++) {
        data[x][y] = [];
        for (let z = 0; z < depth; z++) {
          data[x][y][z] = wfc.buffer.getTileAt(x, y, z);
        }
      }
    }

    self.postMessage({ type: "complete", success: true, data });
  } else {
    self.postMessage({ type: "complete", success: false });
  }
};
```

## API Reference

### Core Classes

#### `WFC3D`

Main Wave Function Collapse solver.

**Constructor Options:**

```typescript
interface WFC3DOptions {
  width: number;
  height: number;
  depth: number;
  tiles: WFCTile3D[];
  seed?: number;
}
```

**Methods:**

- `async generate(onProgress?: (progress: number) => void): Promise<boolean>`
- `reset(): void`

**Properties:**

- `buffer: WFC3DBuffer` - Access to the grid state

#### `WFCTile3D`

Represents a tile type with adjacency rules.

**Constructor:** Takes `VoxelTile3DConfig` or `ModelTile3DConfig`

**Methods:**

- `canBeAdjacentTo(tileId: string, direction: number): boolean`
- `static getOppositeDirection(direction: number): number`

**Static Properties:**

- `WFCTile3D.UP`, `DOWN`, `NORTH`, `SOUTH`, `EAST`, `WEST` - Direction constants

#### `GLBTileLoader`

Loads GLB models with caching.

**Methods:**

- `async loadModel(filepath: string): Promise<LoadedModelData>`
- `async loadTileset(configs: ModelTile3DConfig[]): Promise<Map<string, LoadedModelData>>`
- `clearCache(): void`
- `getCacheStats(): { size: number; keys: string[] }`

#### `InstancedModelRenderer`

Memory-efficient renderer using InstancedMesh.

**Constructor:**

```typescript
constructor(
  scene: THREE.Scene,
  modelData: Map<string, LoadedModelData>,
  cellSize: number = 1
)
```

**Methods:**

- `render(collapsedGrid: string[][][]): void`
- `setOffset(x: number, y: number, z: number): void`
- `clear(): void`
- `getStats(): { tileTypes: number; totalInstances: number }`
- `dispose(): void`

### Type Definitions

```typescript
interface VoxelTile3DConfig {
  id: string;
  weight?: number;
  color?: string;
  adjacency?: {
    up?: string[];
    down?: string[];
    north?: string[];
    south?: string[];
    east?: string[];
    west?: string[];
  };
}

interface ModelTile3DConfig {
  id: string;
  weight?: number;
  filepath: string;
  adjacency?: {
    up?: string[];
    down?: string[];
    north?: string[];
    south?: string[];
    east?: string[];
    west?: string[];
  };
}
```

## TypeScript Support

The library is fully typed with TypeScript. All types are automatically exported and available for import.

```typescript
import type {
  VoxelTile3DConfig,
  ModelTile3DConfig,
  WFC3DOptions,
  LoadedModelData,
  TileInstance,
} from "three-collapse";
```

## Performance Tips

1. **Use Web Workers** for large grids to avoid blocking the main thread
2. **Use InstancedModelRenderer** for model-based WFC (60x memory reduction)
3. **Adjust grid size** - larger grids take exponentially longer
4. **Simplify adjacency rules** - fewer constraints = faster generation
5. **Cache GLB models** - the loader automatically caches by filepath

## Troubleshooting

### "Cannot find module 'three-collapse'"

- Ensure you've installed the package: `npm install three-collapse`
- Check your node_modules directory
- Try deleting node_modules and running `npm install` again

### TypeScript errors

- Make sure you have `@types/three` installed
- Update your tsconfig.json to include "moduleResolution": "node"

### Models not loading

- Verify GLB file paths are correct
- Check that files are accessible from your public directory
- Use absolute paths starting with `/`

## Examples

See the `examples/` directory in the repository for complete working examples:

- `examples/tiles/voxels/tileset.ts` - Voxel tileset example
- `examples/tiles/models/tileset.ts` - Model tileset example
- `src/main.ts` - Complete voxel demo
- `examples/models/demo.ts` - Complete model demo

## License

MIT - See LICENSE file for details
