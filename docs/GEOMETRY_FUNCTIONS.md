# Geometry Functions - Using Procedural Geometry with Model Tiles

The `ModelTile3DConfig` interface supports both GLB model files and procedural geometry functions through a single `model` property, giving you flexibility in how you define your tiles.

## Overview

The `model` property accepts either:

1. **String** - Path to a GLB file
2. **Function** - A function that returns a Three.js object

## Usage

### Option 1: GLB Model Files

Load pre-made 3D models from GLB files:

```typescript
const tile: ModelTile3DConfig = {
  id: "wall",
  weight: 2,
  model: "/models/wall.glb", // Path to GLB file
  adjacency: {
    up: ["wall", "roof"],
    down: ["wall", "floor"],
    // ... other adjacency rules
  },
};
```

### Option 2: Geometry Functions

Create Three.js geometry directly in your code:

```typescript
const tile: ModelTile3DConfig = {
  id: "cube",
  weight: 2,
  model: () => {
    // Create geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.5,
      metalness: 0.2,
    });

    // Return a Three.js Mesh or Object3D
    return new THREE.Mesh(geometry, material);
  },
  adjacency: {
    up: ["cube", "air"],
    down: ["cube", "base"],
    // ... other adjacency rules
  },
};
```

## Mixed Tilesets

You can combine both approaches in the same tileset:

```typescript
export const mixedTileset: ModelTile3DConfig[] = [
  // GLB model
  {
    id: "building",
    model: "/models/building.glb",
    adjacency: {
      /* ... */
    },
  },

  // Procedural geometry (function)
  {
    id: "sphere",
    model: () => {
      const geometry = new THREE.SphereGeometry(0.5, 16, 16);
      const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      return new THREE.Mesh(geometry, material);
    },
    adjacency: {
      /* ... */
    },
  },
];
```

## Helper Functions

The library provides several helper functions for creating common tile types:

### `createAirTile()`

Creates a minimal "air" tile with a single point geometry. This is the most efficient way to represent empty space:

```typescript
import { createAirTile } from "three-collapse";

{
  id: "air",
  model: createAirTile, // Minimal single-point geometry
}
```

### `createBoxTile(color, size?)`

Creates a simple colored box tile:

```typescript
import { createBoxTile } from "three-collapse";

{
  id: "cube",
  model: () => createBoxTile(0x4a90e2, 1), // Blue box
}
```

### `createSphereTile(color, radius?, segments?)`

Creates a simple colored sphere tile:

```typescript
import { createSphereTile } from "three-collapse";

{
  id: "sphere",
  model: () => createSphereTile(0xff0000, 0.5, 16), // Red sphere
}
```

### `createCylinderTile(color, radiusTop?, radiusBottom?, height?, segments?)`

Creates a simple colored cylinder tile:

```typescript
import { createCylinderTile } from "three-collapse";

{
  id: "pillar",
  model: () => createCylinderTile(0x808080, 0.3, 0.3, 1, 16), // Gray cylinder
}
```

## Examples

### Simple Cube (Manual)

```typescript
{
  id: "cube",
  model: () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    return new THREE.Mesh(geometry, material);
  },
}
```

### Textured Cylinder

```typescript
{
  id: "pillar",
  model: () => {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.1,
    });
    return new THREE.Mesh(geometry, material);
  },
}
```

### Complex Object with Group

```typescript
{
  id: "lamp",
  model: () => {
    const group = new THREE.Group();

    // Base
    const baseGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.1);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.4;
    group.add(pole);

    // Light
    const lightGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.y = 0.8;
    group.add(light);

    return group;
  },
}
```

### Air Tile (Using Helper)

```typescript
import { createAirTile } from "three-collapse";

{
  id: "air",
  model: createAirTile, // Most efficient - single point geometry
}
```

### Air Tile (Manual Alternative)

```typescript
{
  id: "air",
  model: () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0]); // Single point
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.MeshBasicMaterial({ visible: false });
    return new THREE.Mesh(geometry, material);
  },
}
```

## Benefits

### Geometry Functions

- ✅ No external files needed
- ✅ Fully procedural and parameterizable
- ✅ Perfect for simple shapes
- ✅ Fast iteration (no file export/import)
- ✅ Can use variables and logic
- ✅ Smaller file size for simple shapes

### GLB Models

- ✅ Complex, detailed models
- ✅ Created in 3D modeling software
- ✅ Can include textures, animations
- ✅ Easier for artists to work with
- ✅ Reusable across projects

## Implementation Details

The `GLBTileLoader` automatically detects whether the `model` property is a string or a function:

- **If `model` is a string:** The loader will load the GLB file asynchronously
- **If `model` is a function:** The loader will call your function to create the geometry

The geometry function should return:

- A `THREE.Mesh` (most common)
- A `THREE.Object3D` (for complex objects)
- A `THREE.Group` (for composite objects)

The loader will automatically extract the first mesh's geometry and material for instanced rendering.

## Performance Considerations

- Geometry functions are called once during tileset loading
- The resulting geometry is cloned and reused via instanced rendering
- There's no performance difference between GLB models and geometry functions after initial loading
- Keep geometry complexity reasonable for performance (aim for <1000 triangles per tile)

## Working with Web Workers

**Important:** Functions cannot be sent to Web Workers! When using the WFC algorithm in a worker, you must strip out the `model` property before sending tiles.

The library provides a helper function for this:

```typescript
import { prepareTilesForWorker } from "three-collapse";

// In your main thread, before sending to worker:
const tilesForWorker = prepareTilesForWorker(yourTiles);

worker.postMessage({
  type: "generate",
  tiles: tilesForWorker, // Only contains id, weight, adjacency
  // ... other options
});
```

**Why?**

- Web Workers use the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- Functions cannot be cloned and sent across worker boundaries
- The worker only needs tile metadata (id, weight, adjacency) to run the WFC algorithm
- The actual model loading/creation happens in the main thread after WFC completes

**Example:**

```typescript
// ❌ This will fail - can't send functions to worker
worker.postMessage({
  tiles: [
    { id: "cube", model: () => createBoxTile(0xff0000) }, // Error!
  ],
});

// ✅ This works - only send serializable data
worker.postMessage({
  tiles: prepareTilesForWorker([
    { id: "cube", model: () => createBoxTile(0xff0000) },
  ]), // Returns: [{ id: "cube" }]
});
```

## See Also

- [ModelTile3DConfig Interface](../src/wfc3d/WFCTile3D.ts)
- [GLBTileLoader Implementation](../src/loaders/GLBTileLoader.ts)
- [Mixed Tileset Example](../examples/tiles/models/tileset.ts)
