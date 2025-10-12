# 3D Wave Function Collapse Implementation

## Overview

This implementation extends the Wave Function Collapse (WFC) algorithm to 3D space with 6-way adjacency constraints, suitable for procedural voxel world generation.

## Core Algorithm

### WFCTile3D
Represents a single tile type with:
- Unique ID
- Weight (for probabilistic selection)
- Color (for rendering)
- Adjacency rules for 6 directions: UP, DOWN, NORTH, SOUTH, EAST, WEST

### WFC3DBuffer
Manages the 3D grid state:
- Each cell tracks possible tiles (superposition)
- Cells can be in collapsed or uncollapsed state
- Provides neighbor access in all 6 directions
- Tracks entropy (number of possible states) per cell

### WFC3D Solver
Main algorithm implementation:

1. **Initialization**: All cells start with all tiles possible
2. **Selection**: Find cell(s) with minimum entropy
3. **Collapse**: Choose a tile based on weighted probability
4. **Propagation**: Update neighbor constraints recursively
5. **Repeat**: Until all cells collapsed or contradiction occurs

#### Constraint Propagation
- When a cell collapses, constrains all 6 neighbors
- Uses adjacency rules to filter possible tiles
- Propagates recursively through affected cells
- Detects contradictions (no valid tiles remaining)

## Web Worker Integration

The `wfc.worker.ts` file provides async generation:
- Runs WFC algorithm in background thread
- Reports progress updates to main thread
- Keeps UI responsive during generation
- Returns complete 3D tile array on success

## Demo Application

Built with Three.js and Vite:
- Renders 8×8×8 voxel world
- Interactive orbit controls
- Seed-based reproducible generation
- Progress indicator
- Real-time 3D visualization

## Example Tileset

The voxel tileset demonstrates terrain generation:

- **Air**: Empty space, can appear anywhere
- **Grass**: Surface layer, must have air above, dirt/stone below
- **Dirt**: Middle layer, between grass and stone
- **Stone**: Base layer, forms the bottom

Adjacency rules create natural-looking terrain layers.

## Usage Example

```typescript
import { WFC3D, WFCTile3D } from './src/wfc3d';

// Define tiles with adjacency rules
const tiles = [
  new WFCTile3D({
    id: 'grass',
    weight: 2,
    color: '#7CFC00',
    adjacency: {
      up: ['air'],
      down: ['dirt', 'stone'],
      // ... other directions
    }
  }),
  // ... more tiles
];

// Create and run WFC
const wfc = new WFC3D({
  width: 8,
  height: 8,
  depth: 8,
  tiles,
  seed: 12345 // Optional
});

const success = await wfc.generate((progress) => {
  console.log(`${Math.round(progress * 100)}% complete`);
});

if (success) {
  // Access generated world
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      for (let z = 0; z < 8; z++) {
        const tileId = wfc.buffer.getTileAt(x, y, z);
        console.log(`Cell [${x},${y},${z}]: ${tileId}`);
      }
    }
  }
}
```

## Performance Considerations

- Grid size affects generation time: O(n³) cells
- Each collapse requires neighbor constraint checks
- Propagation can cascade through many cells
- Web Worker prevents UI blocking
- Typical 8×8×8 generation: <1 second

## Future Enhancements

Possible improvements:
- Backtracking on contradiction (increase success rate)
- Custom tile meshes/textures
- Larger grid sizes with chunking
- Additional tileset examples
- Export/import generated worlds
- Rotation/symmetry for tiles
