# Adjacency Exclusion Rules

## Overview

The WFC3D system now supports both **inclusive** and **exclusive** adjacency rules, giving you more flexibility in defining tile placement constraints.

## Rule Types

### Inclusive Rules (Default)

Use the standard direction properties: `up`, `down`, `north`, `south`, `east`, `west`

**Behavior**: Only the tiles listed in the array are allowed in that direction.

```typescript
{
  id: "wall",
  adjacency: {
    up: ["ceiling", "air"],    // ONLY ceiling or air can be above
    down: ["floor"]             // ONLY floor can be below
  }
}
```

### Exclusive Rules (New!)

Use the `Ex` suffix: `upEx`, `downEx`, `northEx`, `southEx`, `eastEx`, `westEx`

**Behavior**: All tiles EXCEPT those listed in the array are allowed in that direction.

```typescript
{
  id: "platform",
  adjacency: {
    downEx: ["air"],           // Anything EXCEPT air can be below
    upEx: ["solid_block"]      // Anything EXCEPT solid_block can be above
  }
}
```

## When to Use Each Type

### Use Inclusive Rules When:

- You have a small set of allowed tiles
- You want strict, explicit control
- Example: A ceiling tile that can only touch specific things

### Use Exclusive Rules When:

- You have a large tileset and want to exclude just a few tiles
- It's easier to say what's NOT allowed than what IS allowed
- Example: "Can touch anything except water and lava"

## Type Safety

**Important**: TypeScript now **enforces** that you cannot specify both inclusive and exclusive rules for the same direction. If you try to define both `up` and `upEx`, TypeScript will show a compile-time error.

```typescript
{
  id: "valid_tile",
  adjacency: {
    up: ["air"],        // ✓ Valid - only inclusive
    downEx: ["air"]     // ✓ Valid - exclusive on different direction
  }
}

{
  id: "invalid_tile",
  adjacency: {
    up: ["air"],        // ❌ TypeScript Error
    upEx: ["solid"]     // ❌ Can't specify both for same direction
  }
}
```

## Practical Examples

### Example 1: Simple Platform

Only prevent floating in air:

```typescript
{
  id: "platform",
  model: "/models/platform.glb",
  adjacency: {
    downEx: ["air"]  // Must be supported by something (not air)
  }
}
```

### Example 2: Roof Tile

Can only have sky or air above, but anything except dirt below:

```typescript
{
  id: "roof",
  model: "/models/roof.glb",
  adjacency: {
    up: ["sky", "air"],      // Inclusive: only sky or air above
    downEx: ["dirt", "grass"] // Exclusive: anything except dirt/grass below
  }
}
```

### Example 3: Water Block

Exclude all solid blocks but allow flowing:

```typescript
{
  id: "water",
  model: "/models/water.glb",
  adjacency: {
    upEx: ["stone", "wood", "metal"],     // Can't have solids above
    downEx: ["air"],                       // Can't float in air
    northEx: ["lava"],                     // Keep away from lava
    southEx: ["lava"],
    eastEx: ["lava"],
    westEx: ["lava"]
  }
}
```

### Example 4: Versatile Connector

Works with everything except specific incompatible tiles:

```typescript
{
  id: "connector",
  model: "/models/connector.glb",
  adjacency: {
    upEx: ["heavy_block"],      // Can't support heavy things
    downEx: ["fragile_glass"],  // Can't rest on fragile things
    // All horizontal directions unrestricted
  }
}
```

### Example 5: Mixed Usage in Tileset

```typescript
const tileset: ModelTile3DConfig[] = [
  {
    id: "air",
    model: "/models/empty.glb",
    weight: 1,
    // No restrictions - can be anywhere
  },
  {
    id: "ground",
    model: "/models/ground.glb",
    weight: 5,
    adjacency: {
      up: ["air", "grass", "platform"], // Inclusive: specific tiles above
      downEx: ["air"], // Exclusive: not floating
    },
  },
  {
    id: "decorative",
    model: "/models/decoration.glb",
    weight: 2,
    adjacency: {
      // Exclude only tiles that would look bad
      upEx: ["heavy_block"],
      downEx: ["air", "water"],
      northEx: ["wall"],
      southEx: ["wall"],
      eastEx: ["wall"],
      westEx: ["wall"],
    },
  },
];
```

## Performance Considerations

### Inclusive Rules

- **Fast lookup**: Check if tile is in Set
- **Best for**: Small allowed lists

### Exclusive Rules

- **Iteration**: Must check all tiles in tileset
- **Best for**: Small exclusion lists with large tilesets

**Tip**: If you have 20 tiles and want to allow 18 of them, use `Ex` and list only the 2 excluded tiles!

## Migration Guide

### Old Approach (Inclusive Only)

```typescript
{
  id: "special",
  adjacency: {
    // Had to list all 15 allowed tiles
    up: ["tile1", "tile2", "tile3", "tile4", "tile5",
         "tile6", "tile7", "tile8", "tile9", "tile10",
         "tile11", "tile12", "tile13", "tile14", "tile15"]
  }
}
```

### New Approach (Exclusive)

```typescript
{
  id: "special",
  adjacency: {
    // Much simpler - just exclude the 2 incompatible tiles
    upEx: ["incompatible1", "incompatible2"]
  }
}
```

## Validation Tips

1. **Type-safe**: TypeScript prevents mixing inclusive and exclusive for the same direction
2. **Be explicit**: Comment why you're using exclusion rules
3. **Test thoroughly**: Exclusive rules affect more tiles than you might expect
4. **Use validator**: The TilesetValidator will warn about potential issues

## Common Patterns

### Pattern 1: Ground Tiles

```typescript
adjacency: {
  downEx: ["air"],        // Must be supported
  up: ["air", "grass"]    // Only air/grass can grow on top
}
```

### Pattern 2: Ceiling Tiles

```typescript
adjacency: {
  upEx: ["air"],          // Must have something above
  down: ["air", "wire"]   // Only air/wire below
}
```

### Pattern 3: Bridge Tiles

```typescript
adjacency: {
  downEx: ["solid"],      // Only spans over non-solid
  upEx: []                // Everything allowed above
}
```

### Pattern 4: Connector Pieces

```typescript
adjacency: {
  // Very permissive - exclude only specific bad combinations
  northEx: ["incompatible_north"],
  southEx: ["incompatible_south"]
  // east, west, up, down unrestricted
}
```

## Debugging

If you're getting unexpected results:

1. **Check precedence**: Make sure you're not accidentally mixing inclusive/exclusive
2. **Verify tile IDs**: Ensure excluded tile IDs match exactly
3. **Test with small sets**: Start with 3-4 tiles before scaling up
4. **Use logging**: Add console.logs to see what's being excluded
5. **Visualize**: Generate small grids to see the pattern

## TypeScript Type Safety

The type definitions ensure compile-time safety and prevent mixing inclusive/exclusive:

```typescript
import { ModelTile3DConfig } from "three-collapse";

// ✓ Valid - only one rule per direction
const validTile: ModelTile3DConfig = {
  id: "mytile",
  model: "/models/tile.glb",
  adjacency: {
    up: ["air"], // ✓ Inclusive
    downEx: ["solid"], // ✓ Exclusive on different direction
  },
};

// ❌ Invalid - TypeScript will show error
const invalidTile: ModelTile3DConfig = {
  id: "badtile",
  model: "/models/tile.glb",
  adjacency: {
    up: ["air"], // ❌ TypeScript Error:
    upEx: ["solid"], // Cannot specify both up and upEx
  },
};
```

## Summary

| Feature         | Inclusive (`up`)          | Exclusive (`upEx`)              |
| --------------- | ------------------------- | ------------------------------- |
| **Logic**       | Only listed tiles allowed | All except listed tiles allowed |
| **Best for**    | Small allow-lists         | Small deny-lists                |
| **Performance** | Fast Set lookup           | Iterates all tiles              |
| **Precedence**  | Takes priority            | Used if inclusive not set       |
| **Default**     | Empty = nothing allowed   | Empty = everything allowed      |

Choose the rule type that makes your tileset definition clearer and more maintainable!
