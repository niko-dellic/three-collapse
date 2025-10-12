# three-collapse

A 3D Wave Function Collapse (WFC) implementation built with Three.js and TypeScript.

## Features

- **3D Wave Function Collapse**: Full 3D procedural generation using WFC algorithm
- **6-way Adjacency**: Supports up, down, north, south, east, west neighbor constraints
- **Web Worker Support**: Asynchronous generation to keep UI smooth
- **Interactive Demo**: Live demo with 8×8×8 voxel world
- **Customizable Tilesets**: Easy-to-configure tile adjacency rules
- **TypeScript**: Fully typed codebase

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (typically http://localhost:5173)

### Build

```bash
npm run build
```

## Usage

### Basic WFC3D Example

```typescript
import { WFC3D, WFCTile3D } from './src/wfc3d';

// Define tiles
const tiles = [
  new WFCTile3D({
    id: 'grass',
    weight: 1,
    color: '#7CFC00',
    adjacency: {
      up: ['air'],
      down: ['dirt'],
      // ... other directions
    }
  }),
  // ... more tiles
];

// Create WFC instance
const wfc = new WFC3D({
  width: 8,
  height: 8,
  depth: 8,
  tiles,
  seed: 12345 // Optional seed for reproducible results
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
const worker = new Worker(
  new URL('./wfc.worker.ts', import.meta.url),
  { type: 'module' }
);

worker.postMessage({
  type: 'generate',
  width: 8,
  height: 8,
  depth: 8,
  tiles: tilesetConfig,
  seed: 12345
});

worker.onmessage = (e) => {
  if (e.data.type === 'complete') {
    const voxelData = e.data.data; // 3D array of tile IDs
  }
};
```

## Architecture

### Core Modules

- **WFCTile3D**: Represents a single tile type with adjacency rules
- **WFC3DBuffer**: Manages the 3D grid and cell states
- **WFC3D**: Main solver that implements the WFC algorithm
- **wfc.worker.ts**: Web Worker wrapper for async generation

### Directory Structure

```
src/
├── wfc3d/               # Core WFC modules
│   ├── WFCTile3D.ts    # Tile definition
│   ├── WFC3DBuffer.ts  # Grid buffer
│   ├── WFC3D.ts        # Main solver
│   └── index.ts        # Module exports
├── wfc.worker.ts       # Web Worker
└── main.ts             # Demo application

examples/
└── tiles/
    └── voxels/
        └── tileset.ts  # Example voxel tileset
```

## Demo Controls

- **Generate**: Generate a new voxel world with current seed
- **Random Seed**: Generate a new random seed
- **Seed Input**: Enter a specific seed for reproducible results
- **Mouse**: Orbit camera around the scene
- **Scroll**: Zoom in/out

## Algorithm

The 3D Wave Function Collapse algorithm works by:

1. Starting with all cells in superposition (all tiles possible)
2. Selecting the cell with minimum entropy (fewest possibilities)
3. Collapsing it to a single tile based on weighted random selection
4. Propagating constraints to neighbors in all 6 directions
5. Repeating until all cells are collapsed or a contradiction occurs

## License

MIT - See LICENSE file for details