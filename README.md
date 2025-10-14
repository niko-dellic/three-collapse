# three-collapse

A 3D Wave Function Collapse (WFC) implementation built with Three.js and TypeScript.

## Features

- **3D Wave Function Collapse**: Full 3D procedural generation using WFC algorithm
- **6-way Adjacency**: Supports up, down, north, south, east, west neighbor constraints
- **Web Worker Support**: Asynchronous generation to keep UI smooth
- **Dual Rendering Modes**:
  - **Voxel-based**: Simple colored cubes for prototyping
  - **Model-based**: GLB file support with instanced rendering for memory efficiency
- **Interactive Demos**:
  - Voxel with simple terrain generation
  - World with 3D asset loading
- **Adjacency Builder Tool**: Visual interface for building tile adjacency rules
  - 3D preview of tile pairs
  - Automatic symmetry enforcement
  - Export to JSON or GLB formats
  - Continue from existing tilesets
- **Customizable Tilesets**: Easy-to-configure tile adjacency rules
- **TypeScript**: Fully typed codebase
- **Memory Efficient**: Uses InstancedMesh for rendering thousands of models

## Quick Start

### Installation

```bash
npm install three-collapse three
```

### Basic Usage with WFCGenerator (Recommended)

The `WFCGenerator` class is the main entry point - it handles workers, retries, expansion, and real-time updates automatically:

```typescript
import { WFCGenerator } from "three-collapse";

// Create generator
const generator = new WFCGenerator(myTileset, {
  workerCount: 4,
  maxRetries: 3,
  autoExpansion: true,
});

// Generate with real-time tile updates
const grid = await generator.generate(20, 10, 20, {
  onProgress: (progress) => console.log(`${(progress * 100).toFixed(1)}%`),
  onTileUpdate: (x, y, z, tileId) => renderer.updateTile(x, y, z, tileId),
});

// Clean up
generator.dispose();
```

📚 **See [WFCGenerator Usage Guide](./docs/WFCGENERATOR_USAGE.md) for complete documentation.**

### Advanced Usage

For lower-level control, you can use the core WFC classes directly:

```typescript
import { WFC3D, WFCTile3D, VoxelTile3DConfig } from "three-collapse";
```

See [`LIBRARY_USAGE.md`](./docs/LIBRARY_USAGE.md) for advanced usage examples.

### For Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/three-collapse.git
cd three-collapse
npm install
```

### Development

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (typically http://localhost:5173)

**Available Demos:**

- `/` - Voxel-based demo (colored cubes)
- `/models.html` - Model-based demo (GLB files)
- `/adjacency-builder.html` - Visual adjacency builder tool
- `/adjacency-demo.html` - Complete GLB userData workflow demo

### Build

```bash
npm run build
```

## Usage

### Voxel-Based WFC Example

```typescript
import { WFC3D, WFCTile3D, VoxelTile3DConfig } from "./src/wfc3d";

// Define voxel tiles
const tiles = [
  new WFCTile3D({
    id: "grass",
    weight: 1,
    color: "#7CFC00",
    adjacency: {
      up: ["air"],
      down: ["dirt"],
      // ... other directions
    },
  } as VoxelTile3DConfig),
  // ... more tiles
];

// Create WFC instance
const wfc = new WFC3D({
  width: 8,
  height: 8,
  depth: 8,
  tiles,
  seed: 12345, // Optional seed for reproducible results
});

// Generate
const success = await wfc.generate((progress) => {
  console.log(`Progress: ${progress * 100}%`);
});

if (success) {
  // Access generated voxels
  const tileId = wfc.buffer.getTileAt(x, y, z);
}
```

### Using Web Worker

```typescript
const worker = new Worker(new URL("./wfc.worker.ts", import.meta.url), {
  type: "module",
});

worker.postMessage({
  type: "generate",
  width: 8,
  height: 8,
  depth: 8,
  tiles: tilesetConfig,
  seed: 12345,
});

worker.onmessage = (e) => {
  if (e.data.type === "complete") {
    const voxelData = e.data.data; // 3D array of tile IDs
  }
};
```

### Model-Based WFC Example

```typescript
import { WFC3D, WFCTile3D, ModelTile3DConfig } from "./src/wfc3d";
import { GLBTileLoader } from "./src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "./src/renderers/InstancedModelRenderer";

// Define model tiles
const modelTiles: ModelTile3DConfig[] = [
  {
    id: "block",
    weight: 2,
    filepath: "/models/block.glb",
    adjacency: {
      up: ["block", "air"],
      down: ["block", "base"],
      // ... other directions
    },
  },
  // ... more tiles
];

// Load GLB models
const loader = new GLBTileLoader();
const modelData = await loader.loadTileset(modelTiles);

// Create and run WFC
const tiles = modelTiles.map((config) => new WFCTile3D(config));
const wfc = new WFC3D({ width: 10, height: 8, depth: 10, tiles });
const success = await wfc.generate();

if (success) {
  // Render using instanced meshes
  const renderer = new InstancedModelRenderer(scene, modelData, 1);
  const gridData = []; // Extract 3D array from wfc.buffer
  renderer.render(gridData);
}
```

### Adjacency Builder Tool

Building correct adjacency rules is crucial for WFC. The Adjacency Builder provides a visual interface to define these rules.

**Programmatic Usage**:

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

new AdjacencyBuilderUI({
  existingTileset: myTileset,
  onExportJSON: (json) => {
    console.log("Exported:", json);
  },
});
```

**Web Interface**:

1. Navigate to `/adjacency-builder.html`
2. Choose your input mode (Auto-discover / Upload / Continue)
3. Review each tile pair direction-by-direction
4. Export to JSON or GLB format

The tool automatically enforces symmetry and optimizes self-pair comparisons.

📚 **See [Adjacency Builder API](./docs/ADJACENCY_BUILDER_API.md) for programmatic usage.**  
📚 **See [Adjacency Builder Guide](./docs/ADJACENCY_BUILDER.md) for web interface usage.**

## Architecture

### Core Modules

- **WFCTile3D**: Represents a single tile type with adjacency rules
- **WFC3DBuffer**: Manages the 3D grid and cell states
- **WFC3D**: Main solver that implements the WFC algorithm
- **wfc.worker.ts**: Web Worker wrapper for async generation

### Directory Structure

```
src/
├── wfc3d/                      # Core WFC modules
│   ├── WFCTile3D.ts           # Tile definitions (Voxel & Model)
│   ├── WFC3DBuffer.ts         # Grid buffer
│   ├── WFC3D.ts               # Main solver
│   └── index.ts               # Module exports
├── loaders/
│   └── GLBTileLoader.ts       # GLB model loader with caching
├── renderers/
│   └── InstancedModelRenderer.ts  # Instanced mesh renderer
├── wfc.worker.ts              # Web Worker
└── main.ts                    # Voxel

examples/
├── models/
│   └── demo.ts                # Model-based demo
└── tiles/
    ├── voxels/
    │   └── tileset.ts         # Voxel tileset
    └── models/
        └── tileset.ts         # Model tileset

public/
└── models/                    # GLB model assets
    └── README.md              # Asset documentation
```

## Demo Controls

### Voxel (index.html)

- **Generate**: Generate a new voxel world with current seed
- **Random Seed**: Generate a new random seed
- **Seed Input**: Enter a specific seed for reproducible results
- **Mouse**: Orbit camera around the scene
- **Scroll**: Zoom in/out

### World (models.html)

- **Generate**: Load models and generate using WFC
- **Random**: Generate with a new random seed
- **Seed Input**: Enter a specific seed for reproducible results
- **Mouse**: Orbit camera around the scene
- **Scroll**: Zoom in/out

**Note**: The World requires GLB files in the `/public/models/` directory. See `/public/models/README.md` for details on obtaining free 3D assets.

## Algorithm

The 3D Wave Function Collapse algorithm works by:

1. Starting with all cells in superposition (all tiles possible)
2. Selecting the cell with minimum entropy (fewest possibilities)
3. Collapsing it to a single tile based on weighted random selection
4. Propagating constraints to neighbors in all 6 directions
5. Repeating until all cells are collapsed or a contradiction occurs

## License

MIT - See LICENSE file for details
