# Base Adjacency Rules (`all` and `allEx`)

## Overview

The `all` and `allEx` adjacency rules provide a convenient way to set base constraints for all faces at once, which can then be overridden on a per-face basis. This significantly reduces repetition in tileset definitions.

## How It Works

### Rule Priority

1. **Base Rules** (`all` or `allEx`): Applied to all 6 faces as defaults
2. **Per-Face Rules**: Override the base rule for specific faces

### Rule Types

- **`all`**: Inclusive base rule - only these tiles are allowed on all faces (unless overridden)
- **`allEx`**: Exclusive base rule - all tiles EXCEPT these are allowed on all faces (unless overridden)
- **Per-face rules**: `up`, `down`, `north`, `south`, `east`, `west` (or their `Ex` variants)

## Basic Examples

### Before: Repetitive Definition

```typescript
{
  id: "grass",
  adjacency: {
    up: ["air"],
    down: ["dirt"],
    north: ["grass", "dirt", "stone"],
    south: ["grass", "dirt", "stone"],
    east: ["grass", "dirt", "stone"],
    west: ["grass", "dirt", "stone"],
  }
}
```

### After: Using `all` Base Rule

```typescript
{
  id: "grass",
  adjacency: {
    all: ["grass", "dirt", "stone"],  // Base rule for all faces
    up: ["air"],                      // Override for up
    down: ["dirt"],                   // Override for down
  }
}
```

## Use Cases

### 1. Simple Block with Exceptions

A block that connects to similar blocks on all sides, but has specific top and bottom rules:

```typescript
{
  id: "brick",
  adjacency: {
    all: ["brick", "concrete", "stone"],  // Horizontal connections
    up: ["air", "brick"],                  // Top can have air or more bricks
    down: ["brick", "concrete"],           // Bottom needs solid support
  }
}
```

### 2. Using Exclusive Base Rules

Exclude certain tiles from all faces, with overrides:

```typescript
{
  id: "platform",
  adjacency: {
    allEx: ["lava", "water"],  // Can't be next to lava or water on any face
    down: ["solid_block"],     // But bottom must be solid
  }
}
```

### 3. Air/Empty Tile

Air that can be anywhere except underground:

```typescript
{
  id: "air",
  weight: 0.1,
  adjacency: {
    all: ["air", "grass", "water", "tree"],  // Can be next to most things
    down: ["grass", "water", "stone"],       // But needs ground below
  }
}
```

### 4. Pipe/Connector System

Pipes that connect to other pipes, with special end pieces:

```typescript
{
  id: "pipe_straight",
  adjacency: {
    all: ["pipe_straight", "pipe_corner", "pipe_joint"],  // Connects to pipe system
    up: ["air"],                                           // Top is open
    down: ["air"],                                         // Bottom is open
  }
}
```

### 5. Exclusion with Specific Allowances

A tile that can't be next to most things, but allows specific connections:

```typescript
{
  id: "charged_block",
  adjacency: {
    allEx: ["water", "organic", "ice"],  // Dangerous to most materials
    north: ["charged_block", "cable"],   // But can connect north
    south: ["charged_block", "cable"],   // And south for cable routing
  }
}
```

## Complex Example: Terrain System

Here's a complete terrain system using base rules:

```typescript
const terrainTileset = [
  {
    id: "air",
    weight: 0.5,
    color: "#87CEEB",
    adjacency: {
      all: ["air"], // Air can be next to air on all sides
      down: ["grass", "stone", "sand"], // But needs solid ground below
    },
  },
  {
    id: "grass",
    weight: 1.0,
    color: "#7CFC00",
    adjacency: {
      all: ["grass", "dirt", "stone"], // Can be next to similar terrain
      up: ["air", "grass"], // Grass or air above
      down: ["dirt", "stone"], // Needs support below
    },
  },
  {
    id: "dirt",
    weight: 1.0,
    color: "#8B4513",
    adjacency: {
      all: ["dirt", "grass", "stone"], // Connects to all terrain
      up: ["dirt", "grass", "air"], // Can have grass growing on top
    },
  },
  {
    id: "stone",
    weight: 0.8,
    color: "#808080",
    adjacency: {
      all: ["stone", "dirt", "ore"], // Dense materials
      up: ["stone", "dirt", "grass"], // Can be exposed or covered
    },
  },
  {
    id: "ore",
    weight: 0.1,
    color: "#FFD700",
    adjacency: {
      allEx: ["air", "grass"], // Can't be exposed to air
      all: ["stone", "dirt"], // Must be surrounded by rock
    },
  },
  {
    id: "water",
    weight: 0.3,
    color: "#4169E1",
    adjacency: {
      all: ["water", "sand"], // Forms bodies of water
      down: ["sand", "stone", "dirt"], // Needs a basin
      up: ["water", "air"], // Can be at surface
    },
  },
  {
    id: "sand",
    weight: 0.5,
    color: "#F4A460",
    adjacency: {
      all: ["sand", "water"], // Beach material
      down: ["sand", "stone"], // Needs support
      up: ["sand", "air", "water"], // Can be exposed or underwater
    },
  },
];
```

## Advanced Patterns

### Pattern 1: Layered System

Define layers with strict vertical rules but flexible horizontal rules:

```typescript
{
  id: "soil",
  adjacency: {
    all: ["soil", "clay", "sand"],      // Horizontal: any soil type
    up: ["grass", "crops"],             // Vertical: only specific layers
    down: ["bedrock", "stone"],
  }
}
```

### Pattern 2: Structural Elements

Architectural pieces that need specific neighbors:

```typescript
{
  id: "wall",
  adjacency: {
    all: ["wall", "window", "door"],    // Can be part of structure horizontally
    down: ["wall", "foundation"],       // Needs support
    up: ["wall", "roof", "air"],        // Can support roof
  }
}
```

### Pattern 3: Fluid Systems

Fluids with directional flow:

```typescript
{
  id: "flowing_water",
  adjacency: {
    all: ["water", "flowing_water"],              // Can be part of water body
    down: ["water", "flowing_water", "source"],   // Flows downward
    up: ["air", "water"],                         // Surface or underwater
  }
}
```

## Benefits

### Code Reduction

**Before:**

```typescript
{
  id: "tile",
  adjacency: {
    up: ["a", "b", "c"],
    down: ["a", "b", "c"],
    north: ["a", "b", "c"],
    south: ["a", "b", "c"],
    east: ["a", "b", "c"],
    west: ["a", "b", "c"],
  }
}
```

**After:**

```typescript
{
  id: "tile",
  adjacency: {
    all: ["a", "b", "c"],
  }
}
```

**Reduction:** 83% less code (6 lines → 1 line)

### Maintainability

Changing the base rule updates all faces at once:

```typescript
// Add "d" to all faces except up
{
  id: "tile",
  adjacency: {
    all: ["a", "b", "c", "d"],  // ← Change in one place
    up: ["a", "b", "c"],        // Up remains unchanged
  }
}
```

### Clarity

The intent is clearer - base behavior is explicitly separate from exceptions:

```typescript
{
  id: "platform",
  adjacency: {
    all: ["platform"],      // Connects to itself everywhere
    down: ["support"],      // Except it needs support below
  }
}
```

## Type Safety

TypeScript ensures you can't mix inclusive and exclusive rules:

```typescript
// ✅ Valid: Using base rule and overrides
{
  adjacency: {
    all: ["a", "b"],
    up: ["c"],
  }
}

// ✅ Valid: Using exclusive base with inclusive override
{
  adjacency: {
    allEx: ["x", "y"],
    up: ["a", "b"],
  }
}

// ❌ Invalid: Mixing inclusive and exclusive for same direction
{
  adjacency: {
    all: ["a", "b"],
    allEx: ["x", "y"],  // TypeScript error!
  }
}

// ❌ Invalid: Mixing inclusive and exclusive override
{
  adjacency: {
    up: ["a"],
    upEx: ["x"],  // TypeScript error!
  }
}
```

## Migration Guide

### Step 1: Identify Repetition

Look for tiles with the same rules repeated across multiple faces:

```typescript
// If you see this pattern...
adjacency: {
  north: ["a", "b", "c"],
  south: ["a", "b", "c"],
  east: ["a", "b", "c"],
  west: ["a", "b", "c"],
}
```

### Step 2: Extract Base Rule

Move the repeated rule to `all`:

```typescript
adjacency: {
  all: ["a", "b", "c"],
}
```

### Step 3: Keep Exceptions

Keep any faces that differ:

```typescript
adjacency: {
  all: ["a", "b", "c"],
  up: ["different"],
  down: ["also_different"],
}
```

## Best Practices

### 1. Use Base Rules for Common Cases

If 4 or more faces share the same rule, use a base rule:

```typescript
// Good: Base rule with overrides
{
  adjacency: {
    all: ["common"],
    up: ["special"],
    down: ["special"],
  }
}

// Less ideal: Repetitive
{
  adjacency: {
    north: ["common"],
    south: ["common"],
    east: ["common"],
    west: ["common"],
    up: ["special"],
    down: ["special"],
  }
}
```

### 2. Use Exclusive for "Everything Except"

When you want to allow most tiles but exclude a few:

```typescript
{
  adjacency: {
    allEx: ["lava", "void"],  // Everything except these dangerous types
  }
}
```

### 3. Override Thoughtfully

Only override faces that truly need different behavior:

```typescript
{
  adjacency: {
    all: ["grass", "dirt"],
    up: ["air"],       // Up is different (needs air)
    down: ["stone"],   // Down is different (needs foundation)
    // north, south, east, west inherit from 'all'
  }
}
```

### 4. Document Intent

Add comments to clarify why overrides exist:

```typescript
{
  id: "bridge",
  adjacency: {
    all: ["air"],              // Bridges span across air
    north: ["bridge", "pier"], // But connect to structure
    south: ["bridge", "pier"],
    down: ["pier", "water"],   // And need support posts
  }
}
```

## Testing

Test that overrides work correctly:

```typescript
import { WFCTile3D } from "three-collapse";

const tile = new WFCTile3D({
  id: "test",
  adjacency: {
    all: ["a", "b"],
    up: ["c"],
  },
});

// Check base rule applies
console.log(tile.canBeAdjacentTo("a", WFCTile3D.NORTH)); // true (from 'all')
console.log(tile.canBeAdjacentTo("b", WFCTile3D.EAST)); // true (from 'all')

// Check override works
console.log(tile.canBeAdjacentTo("a", WFCTile3D.UP)); // false (overridden)
console.log(tile.canBeAdjacentTo("c", WFCTile3D.UP)); // true (from 'up')
```

## Conclusion

Base adjacency rules with `all` and `allEx` provide:

- ✅ **Reduced Repetition**: Define rules once, apply everywhere
- ✅ **Clear Intent**: Base behavior vs. exceptions is explicit
- ✅ **Easy Maintenance**: Change base rule affects all relevant faces
- ✅ **Type Safety**: TypeScript prevents invalid combinations
- ✅ **Backward Compatible**: Old tilesets still work without changes

This feature makes complex tilesets much more maintainable while keeping simple tilesets simple.
