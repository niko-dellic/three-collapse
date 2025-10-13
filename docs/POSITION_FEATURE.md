# Position Transform Feature

## Overview

The `position` parameter has been added to `ModelTile3DConfig`, enabling tiles to be offset from their grid positions at render time. This complements the existing `rotation` and `scale` parameters to provide complete transform control.

## Feature Details

### What's New

- **Position parameter**: Optional offset from grid position
- **Format flexibility**: Supports both object `{x?, y?, z?}` and `THREE.Vector3`
- **World-space offsets**: Applied in world coordinates after rotation and scale

### API Addition

```typescript
export interface ModelTile3DConfig extends BaseTile3DConfig {
  model: string | (() => THREE.Object3D);
  material?: THREE.Material | THREE.Material[];
  position?: THREE.Vector3 | { x?: number; y?: number; z?: number }; // NEW
  rotation?: THREE.Euler | { x?: number; y?: number; z?: number };
  scale?: THREE.Vector3 | number | { x?: number; y?: number; z?: number };
}
```

## Usage Examples

### Basic Position Offset

```typescript
{
  id: "raised_platform",
  model: "/models/platform.glb",
  position: { y: 0.5 } // Raised by 0.5 units
}
```

### Multi-axis Offset

```typescript
{
  id: "offset_decoration",
  model: "/models/decor.glb",
  position: {
    x: 0.1,   // Slight X offset
    y: 0.3,   // Raised
    z: -0.1   // Slight Z offset
  }
}
```

### Combined with Other Transforms

```typescript
{
  id: "complex_tile",
  model: "/models/block.glb",
  position: { y: 0.25 },              // Offset
  rotation: { y: Math.PI / 4 },       // Rotate
  scale: { x: 1, y: 1.5, z: 1 }       // Scale
}
```

## Common Use Cases

1. **Raised/Lowered Tiles**

   - Platforms slightly above ground level
   - Sunken paths or recessed areas

2. **Layered Effects**

   - Floor base + thin overlay (prevents z-fighting)
   - Multiple stacked decorative elements

3. **Ceiling/Wall Mounting**

   - Lights hanging from ceiling
   - Wall-mounted decorations

4. **Alignment Correction**

   - Fix model pivot point issues
   - Adjust for off-center geometry

5. **Fine-tuning Placement**
   - Small offsets for visual variety
   - Precise positioning without grid changes

## Transform Order

When all transforms are present:

1. **Scale** - Model scaled in local space
2. **Rotation** - Scaled model rotated around origin
3. **Position** - Translated to: `gridPosition + positionOffset`

## Implementation Details

### Files Modified

1. **`src/wfc3d/WFCTile3D.ts`**

   - Added `position?` to `ModelTile3DConfig` interface

2. **`src/loaders/GLBTileLoader.ts`**

   - Added `position?: THREE.Vector3` to `LoadedModelData`
   - Updated `applyOverrides()` to process position parameter
   - Handles both `THREE.Vector3` and object format

3. **`src/renderers/InstancedModelRenderer.ts`**
   - Updated `render()` to apply position offset to each instance
   - Combined grid position with tile-level position offset

### Position Processing

```typescript
// In GLBTileLoader.ts
if (config.position) {
  if (config.position instanceof THREE.Vector3) {
    result.position = config.position.clone();
  } else {
    result.position = new THREE.Vector3(
      config.position.x ?? 0,
      config.position.y ?? 0,
      config.position.z ?? 0
    );
  }
}
```

```typescript
// In InstancedModelRenderer.ts
const tilePosition = modelData.position || new THREE.Vector3(0, 0, 0);

position.set(
  instance.x * this.cellSize + tilePosition.x,
  instance.y * this.cellSize + tilePosition.y,
  instance.z * this.cellSize + tilePosition.z
);
```

## Best Practices

### ✅ Do

- Keep offsets small (< 0.5 cell size)
- Use for fine-tuning and layering
- Document why position offsets are used
- Test with different cell sizes

### ❌ Don't

- Use large offsets that cross grid cells visually
- Rely on position for major placement changes
- Forget that position is in world units
- Mix position offsets without documenting the coordinate system

## Performance

### Impact: Minimal

- Position is stored in `LoadedModelData` (per tile type)
- Applied during matrix composition (same as rotation/scale)
- No additional GPU cost
- Maintains efficient instancing

### Memory

- `THREE.Vector3` per tile type (12 bytes)
- Shared across all instances of that tile
- Negligible overhead

## Examples

See `examples/tiles/models/transform-example.ts` for comprehensive examples including:

- `raisedPlatform` - Simple Y-axis raise
- `sunkenPath` - Negative Y offset
- `offsetDecoration` - Multi-axis offset
- `createLayeredFloors()` - Layered tile pattern
- `createCeilingLights()` - Ceiling-mounted objects
- `allTransforms` - Position + rotation + scale

## Documentation

- **Main Guide**: `docs/TRANSFORMS.md` - Updated with position section
- **Examples**: `examples/tiles/models/transform-example.ts` - Added position examples
- **This Document**: Implementation and technical details

## Compatibility

- ✅ Backward compatible (position is optional)
- ✅ Works with existing rotation and scale
- ✅ Compatible with material overrides
- ✅ Works with instanced rendering
- ✅ Supports both format styles (object and THREE.Vector3)

## Testing

Build verification:

```bash
npm run build  # ✅ Passes
```

Type checking:

```bash
tsc --noEmit  # ✅ No errors
```

## Summary

The position parameter rounds out the transform system, providing complete control over tile placement, orientation, and sizing. Combined with rotation and scale, you can now create extensive variations from minimal model assets while maintaining performance through instanced rendering.

**Key Benefits:**

- Fine-tune tile placement without grid modifications
- Create layered visual effects
- Mount objects at specific heights (ceiling, walls)
- Fix model alignment issues
- Reduce asset duplication even further
