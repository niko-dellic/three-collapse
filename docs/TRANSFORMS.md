# Transform Parameters

## Overview

The `position`, `rotation`, and `scale` parameters allow you to transform tiles at render time without modifying the original GLB files. This is perfect for creating variations from a single model.

## Quick Start

```typescript
import * as THREE from "three";
import { ModelTile3DConfig } from "three-collapse";

// Rotate a ramp 90 degrees
const rampEast: ModelTile3DConfig = {
  id: "ramp_east",
  model: "/models/ramp.glb",
  rotation: { y: Math.PI / 2 }, // 90 degrees around Y-axis
};

// Scale a block to be twice as large
const largeBlock: ModelTile3DConfig = {
  id: "large_block",
  model: "/models/block.glb",
  scale: 2, // 200% size (uniform)
};

// Combine all three
const complexBlock: ModelTile3DConfig = {
  id: "complex_transform",
  model: "/models/block.glb",
  position: { y: 0.5 }, // Raised up
  rotation: { y: Math.PI / 4 }, // Rotated 45°
  scale: { x: 1, y: 2, z: 1 }, // Twice as tall
};
```

## Position

Position offsets shift tiles from their grid location. This is useful for fine-tuning placement, creating overlapping effects, or raising/lowering tiles.

### Basic Position Offset

```typescript
{
  id: "raised_platform",
  model: "/models/platform.glb",
  position: { y: 0.5 } // Raised by 0.5 units
}
```

### Multi-axis Position

```typescript
{
  id: "offset_decoration",
  model: "/models/decor.glb",
  position: {
    x: 0.1,   // Slight X offset
    y: 0.3,   // Raised up
    z: -0.1   // Slight Z offset
  }
}
```

### Using THREE.Vector3

```typescript
{
  id: "custom_offset",
  model: "/models/item.glb",
  position: new THREE.Vector3(0, 0.25, 0)
}
```

### Common Position Uses

#### Raised Tiles

```typescript
// Platform slightly above ground
{
  id: "elevated_platform",
  model: "/models/platform.glb",
  position: { y: 0.1 }
}
```

#### Sunken Tiles

```typescript
// Path slightly below ground
{
  id: "sunken_path",
  model: "/models/path.glb",
  position: { y: -0.2 }
}
```

#### Layered Effects

```typescript
// Base floor + overlay
const tiles = [
  {
    id: "floor_base",
    model: "/models/floor.glb",
  },
  {
    id: "floor_overlay",
    model: "/models/floor.glb",
    position: { y: 0.01 }, // Slightly above to prevent z-fighting
  },
];
```

#### Ceiling-mounted Objects

```typescript
// Hang from ceiling
{
  id: "ceiling_light",
  model: "/models/light.glb",
  position: { y: 0.9 } // Near top of cell
}
```

⚠️ **Note**: Keep position offsets small (< 0.5 cell size) to avoid tiles appearing in wrong grid cells visually.

## Rotation

### Basic Rotation (Single Axis)

```typescript
{
  id: "rotated_tile",
  model: "/models/block.glb",
  rotation: { y: Math.PI / 2 } // 90 degrees on Y-axis
}
```

### Multi-axis Rotation

```typescript
{
  id: "complex_rotation",
  model: "/models/block.glb",
  rotation: {
    x: Math.PI / 4, // 45 degrees on X
    y: Math.PI / 2, // 90 degrees on Y
    z: Math.PI / 6  // 30 degrees on Z
  }
}
```

### Using THREE.Euler

```typescript
{
  id: "euler_rotation",
  model: "/models/block.glb",
  rotation: new THREE.Euler(0, Math.PI / 2, 0, 'XYZ')
}
```

### Rotation Reference

| Degrees | Radians | Constant            |
| ------- | ------- | ------------------- |
| 30°     | 0.524   | `Math.PI / 6`       |
| 45°     | 0.785   | `Math.PI / 4`       |
| 60°     | 1.047   | `Math.PI / 3`       |
| 90°     | 1.571   | `Math.PI / 2`       |
| 180°    | 3.142   | `Math.PI`           |
| 270°    | 4.712   | `(3 * Math.PI) / 2` |
| 360°    | 6.283   | `2 * Math.PI`       |

## Scale

### Uniform Scale (All Axes)

```typescript
{
  id: "large_tile",
  model: "/models/block.glb",
  scale: 1.5 // 150% size on all axes
}

{
  id: "small_tile",
  model: "/models/block.glb",
  scale: 0.5 // 50% size (half)
}
```

### Non-uniform Scale (Per-axis)

```typescript
{
  id: "tall_tile",
  model: "/models/block.glb",
  scale: { x: 1, y: 2, z: 1 } // Twice as tall
}

{
  id: "wide_tile",
  model: "/models/block.glb",
  scale: { x: 2, y: 1, z: 2 } // Twice as wide
}

{
  id: "flat_tile",
  model: "/models/block.glb",
  scale: { x: 1, y: 0.25, z: 1 } // Quarter height (flat)
}
```

### Using THREE.Vector3

```typescript
{
  id: "vector_scale",
  model: "/models/block.glb",
  scale: new THREE.Vector3(1.2, 0.8, 1.5)
}
```

## Common Patterns

### Pattern 1: Directional Tiles

Create 4 ramp directions from 1 model:

```typescript
const ramps: ModelTile3DConfig[] = [
  {
    id: "ramp_north",
    model: "/models/ramp.glb",
    rotation: { y: 0 },
  },
  {
    id: "ramp_east",
    model: "/models/ramp.glb",
    rotation: { y: Math.PI / 2 },
  },
  {
    id: "ramp_south",
    model: "/models/ramp.glb",
    rotation: { y: Math.PI },
  },
  {
    id: "ramp_west",
    model: "/models/ramp.glb",
    rotation: { y: (3 * Math.PI) / 2 },
  },
];
```

**Result**: 4 tiles from 1 GLB file!

### Pattern 2: Size Variations

```typescript
const sizes = [0.5, 0.75, 1.0, 1.25, 1.5];

const tiles = sizes.map((size, i) => ({
  id: `block_${i}`,
  model: "/models/block.glb",
  scale: size,
}));
```

**Result**: 5 size variations from 1 GLB file!

### Pattern 3: Height Variations

```typescript
const pillars: ModelTile3DConfig[] = [
  {
    id: "pillar_short",
    model: "/models/pillar.glb",
    scale: { x: 1, y: 0.5, z: 1 },
  },
  {
    id: "pillar_medium",
    model: "/models/pillar.glb",
    scale: { x: 1, y: 1.0, z: 1 },
  },
  {
    id: "pillar_tall",
    model: "/models/pillar.glb",
    scale: { x: 1, y: 2.0, z: 1 },
  },
];
```

### Pattern 4: Rotated Pipes/Connectors

```typescript
const pipes: ModelTile3DConfig[] = [
  {
    id: "pipe_horizontal_x",
    model: "/models/pipe.glb",
    rotation: { x: 0, y: 0, z: Math.PI / 2 },
  },
  {
    id: "pipe_horizontal_z",
    model: "/models/pipe.glb",
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
  },
  {
    id: "pipe_vertical",
    model: "/models/pipe.glb",
    rotation: { x: 0, y: 0, z: 0 },
  },
];
```

### Pattern 5: Combined Transforms

```typescript
{
  id: "special_tile",
  model: "/models/block.glb",
  position: { y: 0.2 },                // Slight raise
  rotation: { y: Math.PI / 4 },        // 45° rotation
  scale: { x: 0.8, y: 1.5, z: 1.2 },   // Scaled unevenly
  material: customMaterial              // Custom material too!
}
```

## Coordinate System

### Axes

```
Y (up)
|
|__ X (right)
/
Z (forward)
```

### Rotation Directions

- **X-axis** (pitch): Rotation around left-right axis
- **Y-axis** (yaw): Rotation around up-down axis
- **Z-axis** (roll): Rotation around forward-back axis

Positive rotation = counter-clockwise when looking down the axis toward origin

## Use Cases

### 1. Directional Building Blocks

```typescript
// Stairs facing 4 directions
const stairs = ["north", "east", "south", "west"].map((dir, i) => ({
  id: `stairs_${dir}`,
  model: "/models/stairs.glb",
  rotation: { y: (i * Math.PI) / 2 },
}));
```

### 2. Terrain Height Variations

```typescript
// Hills of different heights
const hills = [0.5, 1.0, 1.5].map((height, i) => ({
  id: `hill_${i}`,
  model: "/models/hill.glb",
  scale: { x: 1, y: height, z: 1 },
}));
```

### 3. Decorative Variety

```typescript
// Randomly rotated plants for natural look
function createPlant(id: string): ModelTile3DConfig {
  return {
    id,
    model: "/models/plant.glb",
    rotation: { y: Math.random() * Math.PI * 2 }, // Random rotation
    scale: 0.8 + Math.random() * 0.4, // 80-120% size
  };
}
```

### 4. Architectural Elements

```typescript
// Columns of different heights
const columns = [1, 2, 3, 4].map((floors) => ({
  id: `column_${floors}floor`,
  model: "/models/column.glb",
  scale: { x: 1, y: floors, z: 1 },
}));
```

### 5. Pipes and Conduits

```typescript
// T-junction pipe rotated 4 ways
const junctions = [0, 90, 180, 270].map((deg) => ({
  id: `junction_${deg}`,
  model: "/models/t-junction.glb",
  rotation: { y: (deg * Math.PI) / 180 },
}));
```

## Performance Considerations

### Benefits

✅ **Memory efficient**: Share geometry, only transforms differ  
✅ **Fast loading**: Load model once, apply transforms at render  
✅ **Instanced rendering**: Still uses GPU instancing  
✅ **No file duplication**: One model file for many variations

### Best Practices

1. **Prefer uniform scale**: Slightly faster than non-uniform
2. **Minimize unique transforms**: Group similar transforms together
3. **Cache transforms**: Don't create new Euler/Vector3 every frame
4. **Consider bounding boxes**: Scaled objects affect collision detection

## Advanced Usage

### Dynamic Transforms

```typescript
// Create transform at runtime based on game logic
function createDynamicTile(health: number): ModelTile3DConfig {
  return {
    id: `tile_health_${health}`,
    model: "/models/block.glb",
    scale: Math.max(0.5, health / 100), // Shrinks as health decreases
    material: new THREE.MeshStandardMaterial({
      color: health > 50 ? 0x00ff00 : 0xff0000,
    }),
  };
}
```

### Procedural Rotation

```typescript
// Create tiles with incremental rotation for smooth transition
function createRotationSequence(steps: number): ModelTile3DConfig[] {
  return Array.from({ length: steps }, (_, i) => ({
    id: `rotated_${i}`,
    model: "/models/block.glb",
    rotation: { y: (i * Math.PI * 2) / steps },
  }));
}
```

### Mirroring (Negative Scale)

```typescript
{
  id: "mirrored_tile",
  model: "/models/asymmetric.glb",
  scale: { x: -1, y: 1, z: 1 } // Mirror on X-axis
}
```

⚠️ **Warning**: Negative scale inverts normals and may cause lighting issues. Use with caution.

## Coordinate Reference

### Y-axis Rotation (Common for Directional Tiles)

```
     0° (North)
      |
270° -+- 90° (East)
      |
    180° (South)
```

### X-axis Rotation (Tilt Forward/Back)

```
90° (Looking up)
      |
0° ---+--- (Level)
      |
-90° (Looking down)
```

### Z-axis Rotation (Roll Left/Right)

```
-90° (Roll left)
      |
0° ---+--- (No roll)
      |
90° (Roll right)
```

## Troubleshooting

### Model Appears in Wrong Orientation

**Problem**: Rotated model doesn't face expected direction

**Solutions**:

- Check model's default orientation in GLB file
- Adjust rotation values accordingly
- Use Euler rotation with specific order (XYZ, YXZ, etc.)

### Scaled Model Clips Through Floor/Ceiling

**Problem**: Non-uniform scale causes collision issues

**Solutions**:

- Adjust adjacency rules to account for scale
- Update cell size to accommodate larger models
- Use consistent scale ratios

### Rotation Combines Unexpectedly

**Problem**: Per-instance rotation + tile rotation behave oddly

**Solutions**:

- Understand quaternion multiplication order
- Test with simpler rotations first
- Consider using only tile-level or instance-level rotation

### Performance Degradation

**Problem**: Many unique transforms cause slowdown

**Solutions**:

- Reduce number of unique transform combinations
- Use instancing effectively (group similar transforms)
- Profile to identify bottlenecks

## API Reference

### ModelTile3DConfig.position

```typescript
position?: THREE.Vector3 | { x?: number; y?: number; z?: number }
```

**Type**: Optional  
**Default**: No offset (0, 0, 0)  
**Accepts**:

- Object: `{ x: 0, y: 0.5, z: 0 }`
- THREE.Vector3: `new THREE.Vector3(0, 0.5, 0)`

**Units**: World units (same units as cell size)

### ModelTile3DConfig.rotation

```typescript
rotation?: THREE.Euler | { x?: number; y?: number; z?: number }
```

**Type**: Optional  
**Default**: No rotation (identity)  
**Accepts**:

- Object: `{ x: 0, y: Math.PI/2, z: 0 }`
- THREE.Euler: `new THREE.Euler(0, Math.PI/2, 0)`

**Units**: Radians (not degrees!)

### Transform Order

When all three transforms are applied, they occur in this order:

1. **Scale** - Model is scaled in local space
2. **Rotation** - Scaled model is rotated around origin
3. **Position** - Rotated/scaled model is moved to grid position + offset

This means:

- Rotation happens around the model's origin (before translation)
- Position offset is applied in world space
- Scale affects the model before rotation

### ModelTile3DConfig.scale

```typescript
scale?: THREE.Vector3 | number | { x?: number; y?: number; z?: number }
```

**Type**: Optional  
**Default**: No scaling (1, 1, 1)  
**Accepts**:

- Number (uniform): `1.5`
- Object: `{ x: 1, y: 2, z: 1 }`
- THREE.Vector3: `new THREE.Vector3(1, 2, 1)`

## Comparison

### Without Transforms

```
Need 12 GLB files:
- ramp-north.glb
- ramp-east.glb
- ramp-south.glb
- ramp-west.glb
- pillar-short.glb
- pillar-medium.glb
- pillar-tall.glb
- ...

Total: ~6 MB
```

### With Transforms

```typescript
// Need only 2 GLB files
const tiles = [
  ...createRampVariations("/models/ramp.glb"), // 4 tiles
  ...createPillarVariations("/models/pillar.glb"), // 3 tiles
  // ... more variations
];

// Total: ~1 MB (saves 83%!)
```

## Summary

| Feature                 | Benefit                                 |
| ----------------------- | --------------------------------------- |
| **Position**            | Fine-tune placement, create layers      |
| **Rotation**            | Create directional tiles from one model |
| **Scale (uniform)**     | Size variations without new models      |
| **Scale (non-uniform)** | Height/width variations                 |
| **Combined**            | Complex variations from single source   |
| **Memory**              | Share geometry, only transforms differ  |
| **File size**           | Reduce assets by 70-90%                 |
| **Flexibility**         | Runtime transform adjustments           |

Transform parameters give you powerful tools to create varied, interesting WFC tilesets while keeping your asset pipeline lean and efficient!
