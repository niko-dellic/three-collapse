# Material Override Feature

## Overview

The `material` parameter allows you to override the material of loaded GLB models, giving you full control over how your tiles look without needing to modify the GLB files themselves.

## Motivation

### Problems This Solves

1. **File bloat**: Instead of creating 10 GLB files with different colors, use 1 GLB with 10 material overrides
2. **Asset management**: Fewer files to track and maintain
3. **Runtime customization**: Change materials dynamically based on game state
4. **Advanced materials**: Use Three.js materials not supported by GLB format (e.g., transmission, clearcoat)
5. **Memory efficiency**: Share geometry between tiles, only materials differ

## Usage

### Basic Example

```typescript
import * as THREE from "three";
import { ModelTile3DConfig } from "three-collapse";

const myTile: ModelTile3DConfig = {
  id: "red_block",
  model: "/models/block.glb",
  material: new THREE.MeshStandardMaterial({
    color: 0xff0000,
    roughness: 0.5,
    metalness: 0.2,
  }),
  adjacency: {
    downEx: ["air"],
  },
};
```

### Without Override (Default Behavior)

```typescript
const originalTile: ModelTile3DConfig = {
  id: "original_block",
  model: "/models/block.glb",
  // No material override - uses the material from the GLB file
  adjacency: {
    downEx: ["air"],
  },
};
```

## Examples

### Example 1: Color Variations

Reuse the same model with different colors:

```typescript
const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];

const coloredBlocks: ModelTile3DConfig[] = colors.map((color, i) => ({
  id: `block_${i}`,
  model: "/models/block.glb", // Same GLB file
  material: new THREE.MeshStandardMaterial({ color }),
  weight: 1,
}));
```

**Result**: 4 different colored blocks from 1 GLB file!

### Example 2: Metallic Surfaces

```typescript
const metallicTile: ModelTile3DConfig = {
  id: "chrome_block",
  model: "/models/block.glb",
  material: new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.1,
    metalness: 1.0,
  }),
};
```

### Example 3: Glass/Transparent

```typescript
const glassTile: ModelTile3DConfig = {
  id: "glass_block",
  model: "/models/block.glb",
  material: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.95,
    thickness: 0.5,
    roughness: 0.05,
    transparent: true,
  }),
};
```

### Example 4: Emissive (Glowing)

```typescript
const glowingTile: ModelTile3DConfig = {
  id: "glowing_block",
  model: "/models/block.glb",
  material: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff6600,
    emissiveIntensity: 2,
  }),
};
```

### Example 5: Textured Materials

```typescript
const textureLoader = new THREE.TextureLoader();

const texturedTile: ModelTile3DConfig = {
  id: "brick_block",
  model: "/models/block.glb",
  material: new THREE.MeshStandardMaterial({
    map: textureLoader.load("/textures/brick.jpg"),
    normalMap: textureLoader.load("/textures/brick_normal.jpg"),
    roughness: 0.8,
  }),
};
```

### Example 6: Multi-Material Arrays

```typescript
const multiMaterialTile: ModelTile3DConfig = {
  id: "rainbow_block",
  model: "/models/block.glb",
  material: [
    new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Material 0
    new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Material 1
    new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Material 2
  ],
};
```

### Example 7: With Geometry Functions

```typescript
const customTile: ModelTile3DConfig = {
  id: "custom_sphere",
  model: () => {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  },
  // Override the basic material with a fancy one
  material: new THREE.MeshPhysicalMaterial({
    color: 0xffa500,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  }),
};
```

## How It Works

### Loading Process

1. **Load GLB file** → Extract geometry and original material
2. **Check for override** → If `config.material` is defined
3. **Replace material** → Use override instead of GLB material
4. **Clone material** → Create a fresh copy for this tile
5. **Create instances** → Use the overridden material for rendering

### Material Cloning

Materials are automatically cloned to ensure each tile can have independent properties:

```typescript
// If you provide a material, it's cloned for safety
material: myMaterial; // → Internally: myMaterial.clone()
```

This prevents unwanted shared state between tiles.

## Performance Considerations

### Benefits

✅ **Reduced file size**: One geometry, many materials  
✅ **Faster loading**: Load geometry once, swap materials  
✅ **Less memory**: Shared geometry buffer  
✅ **GPU efficient**: Instanced rendering still works

### Best Practices

1. **Reuse materials when possible**: Don't create new material instances unnecessarily
2. **Share textures**: Load textures once, reuse across materials
3. **Limit unique materials**: Each unique material = potential draw call
4. **Use simple materials**: Avoid overly complex shader materials

## Common Patterns

### Pattern 1: Themed Tilesets

```typescript
function createThemedTileset(theme: "fire" | "ice" | "nature") {
  const colors = {
    fire: [0xff0000, 0xff6600, 0xffaa00],
    ice: [0x00ffff, 0x88ccff, 0xccffff],
    nature: [0x00ff00, 0x88ff88, 0x228b22],
  };

  return colors[theme].map((color, i) => ({
    id: `${theme}_block_${i}`,
    model: "/models/block.glb",
    material: new THREE.MeshStandardMaterial({ color }),
  }));
}
```

### Pattern 2: Biome-Specific Materials

```typescript
function createBiomeTiles(biome: string): ModelTile3DConfig[] {
  const biomeMaterials = {
    desert: new THREE.MeshStandardMaterial({
      color: 0xffcc88,
      roughness: 0.9,
    }),
    snow: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
    }),
    forest: new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.7,
    }),
  };

  return [
    {
      id: `${biome}_ground`,
      model: "/models/terrain.glb",
      material: biomeMaterials[biome],
    },
  ];
}
```

### Pattern 3: Damage States

```typescript
const healthyBlock: ModelTile3DConfig = {
  id: "block_healthy",
  model: "/models/block.glb",
  material: new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
};

const damagedBlock: ModelTile3DConfig = {
  id: "block_damaged",
  model: "/models/block.glb", // Same model
  material: new THREE.MeshStandardMaterial({ color: 0xffaa00 }),
};

const brokenBlock: ModelTile3DConfig = {
  id: "block_broken",
  model: "/models/block.glb", // Same model
  material: new THREE.MeshStandardMaterial({ color: 0xff0000 }),
};
```

## Troubleshooting

### Material Not Visible

**Problem**: Material override doesn't appear

**Solutions**:

- Check if lighting is set up correctly (most materials need lights)
- Verify the material is not transparent with opacity 0
- Ensure the geometry has proper normals

### Performance Issues

**Problem**: Rendering is slow with many material overrides

**Solutions**:

- Reduce the number of unique materials
- Use simpler material types (MeshBasicMaterial, MeshLambertMaterial)
- Enable instancing (it's automatic with InstancedModelRenderer)

### Materials Look Wrong

**Problem**: Material appears different than expected

**Solutions**:

- Check renderer settings (tone mapping, gamma correction)
- Verify texture paths are correct
- Ensure proper lighting setup
- Check material properties (roughness, metalness, etc.)

## API Reference

### ModelTile3DConfig.material

```typescript
material?: THREE.Material | THREE.Material[]
```

**Type**: Optional  
**Default**: Uses material from loaded GLB  
**Accepts**:

- Single Material: `new THREE.MeshStandardMaterial(...)`
- Material Array: `[material1, material2, ...]`

**Behavior**:

- If provided, replaces the GLB's material
- If omitted, uses the original GLB material
- Automatically cloned to prevent shared state
- Works with both GLB files and geometry functions

## Comparison

### Without Material Override

```typescript
// Need 3 separate GLB files
/models/der -
  block.glb / // 500 KB
    models /
    blue -
  block.glb / // 500 KB
    models /
    green -
  block.glb; // 500 KB
// Total: 1.5 MB
```

### With Material Override

```typescript
// Need only 1 GLB file
/models/bcklo.glb; // 500 KB

// Create 3 variations with materials
const tiles = [
  { id: "red", model: "/models/block.glb", material: redMat },
  { id: "blue", model: "/models/block.glb", material: blueMat },
  { id: "green", model: "/models/block.glb", material: greenMat },
];
// Total: 500 KB
```

**Savings**: 1 MB (66% reduction!)

## Advanced Usage

### Dynamic Material Updates

```typescript
// Create a material you can modify later
const dynamicMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

const tile: ModelTile3DConfig = {
  id: "dynamic_block",
  model: "/models/block.glb",
  material: dynamicMaterial,
};

// Later in your code, change the material
dynamicMaterial.color.setHex(0x00ff00); // Changes to green
dynamicMaterial.needsUpdate = true;
```

### Shader Materials

```typescript
const shaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0xff0000) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(color * (0.5 + 0.5 * sin(time + vUv.x * 10.0)), 1.0);
    }
  `,
});

const animatedTile: ModelTile3DConfig = {
  id: "animated_block",
  model: "/models/block.glb",
  material: shaderMaterial,
};
```

## Summary

| Feature         | Benefit                               |
| --------------- | ------------------------------------- |
| **File size**   | Reduce asset size by 50-90%           |
| **Memory**      | Share geometry, only materials differ |
| **Flexibility** | Use any Three.js material             |
| **Runtime**     | Change materials dynamically          |
| **Performance** | Instanced rendering still works       |
| **Maintenance** | Fewer files to manage                 |

The material override feature gives you complete control over how your WFC tiles look while keeping your asset pipeline simple and efficient!
