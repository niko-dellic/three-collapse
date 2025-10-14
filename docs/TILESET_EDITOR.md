# Tileset Editor

The Tileset Editor provides a real-time GUI for adjusting transform properties (position, rotation, scale) of each tile type in your WFC generation. Changes immediately propagate to all instances of that tile.

## Features

- **Per-Tile Transform Controls**: Adjust position, rotation, and scale for each tile type
- **Real-Time Updates**: Changes are immediately applied to all instances in the scene
- **Collapsible Interface**: Each tile has its own expandable section
- **Reset Functionality**: Quickly revert to default transforms
- **Intuitive UI**: Numeric inputs for precise control

## Basic Usage

```typescript
import { createTilesetEditor, InstancedModelRenderer } from "three-collapse";
import * as THREE from "three";

// Assuming you have a renderer and tiles
const tilesetEditor = createTilesetEditor({
  tiles: myTiles,
  onTransformChange: (tileId, transform) => {
    // Update the renderer when transforms change
    modelRenderer.updateTileTransform(tileId, {
      position: new THREE.Vector3(
        transform.position.x,
        transform.position.y,
        transform.position.z
      ),
      rotation: new THREE.Euler(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z
      ),
      scale: new THREE.Vector3(
        transform.scale.x,
        transform.scale.y,
        transform.scale.z
      ),
    });
  },
});

// Add to your UI
document.body.appendChild(tilesetEditor.container);
```

## Integration with InstancedModelRenderer

The `InstancedModelRenderer` has been enhanced to support real-time transform updates:

```typescript
// Update transforms for a specific tile type
modelRenderer.updateTileTransform("myTileId", {
  position: new THREE.Vector3(0, 0.5, 0), // Shift up by 0.5 units
  rotation: new THREE.Euler(0, Math.PI / 4, 0), // Rotate 45 degrees
  scale: new THREE.Vector3(1.2, 1.2, 1.2), // Scale up by 20%
});

// All instances of "myTileId" are immediately updated
```

## Complete Example

```typescript
import * as THREE from "three";
import {
  WFCGenerator,
  InstancedModelRenderer,
  GLBTileLoader,
  createTilesetEditor,
} from "three-collapse";

// Setup scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load models and create tiles
const loader = new GLBTileLoader();
const tiles = [
  {
    id: "block",
    model: "models/block.glb",
    weight: 1,
    adjacency: {
      all: ["block", "ramp"],
    },
  },
  {
    id: "ramp",
    model: "models/ramp.glb",
    weight: 0.5,
    adjacency: {
      all: ["block", "ramp"],
    },
  },
];

// Load models
const modelData = await loader.loadTiles(tiles);

// Create renderer
const modelRenderer = new InstancedModelRenderer(scene, modelData, 1);

// Create generator
const generator = new WFCGenerator(tiles);

// Generate initial grid
const grid = await generator.generate(10, 5, 10);
modelRenderer.render(grid);

// Create tileset editor
const tilesetEditor = createTilesetEditor({
  tiles,
  onTransformChange: (tileId, transform) => {
    modelRenderer.updateTileTransform(tileId, {
      position: new THREE.Vector3(
        transform.position.x,
        transform.position.y,
        transform.position.z
      ),
      rotation: new THREE.Euler(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z
      ),
      scale: new THREE.Vector3(
        transform.scale.x,
        transform.scale.y,
        transform.scale.z
      ),
    });
  },
});

// Add editor to DOM
document.body.appendChild(tilesetEditor.container);

// Render loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

## Transform Properties

### Position

- **Range**: -5 to 5 units per axis
- **Step**: 0.1 units
- **Purpose**: Offset the tile from its grid position
- **Use Cases**:
  - Adjust vertical alignment
  - Fine-tune tile placement
  - Create floating or embedded effects

### Rotation

- **Range**: -180° to 180° per axis
- **Step**: 5°
- **Purpose**: Rotate the tile around its center
- **Use Cases**:
  - Fix model orientation issues
  - Create variety through rotation
  - Align directional models

### Scale

- **Range**: 0.1 to 3.0 per axis
- **Step**: 0.1
- **Purpose**: Change the size of the tile
- **Use Cases**:
  - Match model scales from different sources
  - Create size variation
  - Adjust for cell size mismatches

## UI Controls

### Header

Each tile has a collapsible header showing the tile ID. Click to expand/collapse.

### Transform Sections

- **Position (X, Y, Z)**: Offset from grid position
- **Rotation (X, Y, Z)**: Rotation in degrees (converted to radians internally)
- **Scale (X, Y, Z)**: Scale multiplier per axis

### Reset Button

Reverts all transforms for that tile back to their original values from the tile config.

## Advanced Usage

### Programmatic Updates

You can update transforms programmatically without the UI:

```typescript
modelRenderer.updateTileTransform("myTile", {
  position: new THREE.Vector3(0, 1, 0),
  rotation: new THREE.Euler(0, Math.PI / 2, 0),
  scale: new THREE.Vector3(1.5, 1.5, 1.5),
});
```

### Storing Transform State

You can save and restore transform states:

```typescript
// Create editor with initial transforms
const savedTransforms = new Map([
  [
    "block",
    {
      position: { x: 0, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1.2, y: 1.2, z: 1.2 },
    },
  ],
]);

const editor = createTilesetEditor({
  tiles,
  onTransformChange: handleTransformChange,
  initialTransforms: savedTransforms,
});
```

### Batch Updates

For performance, batch transform updates:

```typescript
// Disable rendering temporarily
renderer.setAnimating(false);

// Update multiple tiles
tiles.forEach((tile) => {
  modelRenderer.updateTileTransform(tile.id, {
    scale: new THREE.Vector3(1.5, 1.5, 1.5),
  });
});

// Re-enable rendering
renderer.setAnimating(true);
```

## Performance Considerations

- **Instance Count**: Transform updates are O(n) where n is the number of instances of that tile type
- **Update Frequency**: Updates happen on every input change. For large grids, consider debouncing
- **Memory**: Each tile override stores 3 Vector3/Euler objects

### Optimization Tips

1. **Debounce Updates**: Add a delay before applying changes during fast slider movements
2. **Limit Tiles**: Only show editor for tiles currently in use
3. **Batch Operations**: Group multiple transform changes together

## Styling

The tileset editor comes with default styling but can be customized:

```css
.tileset-editor {
  max-height: 400px; /* Adjust maximum height */
  background: rgba(0, 0, 0, 0.5); /* Change background */
}

.tile-editor {
  border-radius: 8px; /* Adjust tile section styling */
}
```

## API Reference

### createTilesetEditor(config)

Creates a tileset editor UI.

**Parameters:**

- `config.tiles`: Array of tile configurations
- `config.onTransformChange`: Callback when transforms change
  - `tileId`: The ID of the tile being modified
  - `transform`: The new transform values
- `config.initialTransforms` (optional): Map of initial transform overrides

**Returns:**

- `container`: The HTMLDivElement containing the editor
- `tileEditors`: Map of tile IDs to their editor elements

### InstancedModelRenderer.updateTileTransform(tileId, transform)

Updates the transform for all instances of a tile type.

**Parameters:**

- `tileId`: The ID of the tile to update
- `transform`: Partial transform override
  - `position` (optional): THREE.Vector3
  - `rotation` (optional): THREE.Euler
  - `scale` (optional): THREE.Vector3

## See Also

- [Debug Features](./DEBUG_FEATURES.md)
- [InstancedModelRenderer API](../src/renderers/InstancedModelRenderer.ts)
- [Model Tile Configuration](./LIBRARY_USAGE.md#model-tiles)
