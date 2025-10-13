# Adjacency Rules Guide

## Understanding Adjacency Specification

### The Two Ways to Allow All Tiles

```typescript
{
  id: "base",
  adjacency: {
    // Option 1: Omit the direction (recommended)
    // down: not specified

    // Option 2: Don't use empty arrays for "all tiles"
    // down: [] ❌ This means NO tiles allowed!
  }
}
```

**Key Rule:**

- **Omit a direction** = no restrictions (all tiles allowed)
- **Empty array `[]`** = strict restriction (NO tiles allowed)

## Three Ways to Specify Adjacency

```typescript
{
  id: "tile",
  adjacency: {
    // Option 1: Specific tiles (restrictive)
    up: ["air", "block", "empty"],

    // Option 2: Empty array (STRICT - NO tiles allowed)
    down: [],  // ⚠️ Will cause errors if tile needs neighbors below!

    // Option 3: Omit direction entirely (no restrictions - all tiles allowed)
    // north: not specified
  }
}
```

**Important:**

- `down: []` = **NO tiles allowed** in that direction
- Not including `down` = **ALL tiles allowed** in that direction
- These are **NOT equivalent**!

## Symmetry Requirement (CRITICAL!)

**The validator now ENFORCES symmetry as an ERROR, not a warning.**

### The Rule

If tile A allows tile B in direction D, then tile B **MUST** allow tile A in the opposite direction.

```typescript
// ❌ BAD - Will fail validation
{
  id: "base",
  adjacency: {
    up: ["block"]  // base allows block above
  }
}

{
  id: "block",
  adjacency: {
    down: ["floor"]  // ❌ block doesn't allow base below!
  }
}
```

```typescript
// ✅ GOOD - Symmetric rules
{
  id: "base",
  adjacency: {
    up: ["block"]  // base allows block above
  }
}

{
  id: "block",
  adjacency: {
    down: ["base", "floor"]  // ✅ block allows base below
  }
}
```

## Direction Pairs

When checking symmetry, these directions are opposites:

- `up` ↔ `down`
- `north` ↔ `south`
- `east` ↔ `west`

## Validation Error Messages

The validator will now show **ERRORS** for asymmetry:

```
❌ ASYMMETRY: 'base' allows 'block' in up direction, but 'block'
   does NOT allow 'base' in down direction. This will cause contradictions!

Fix: Add 'base' to tile 'block' adjacency.down array
```

## Your Base Tile Fix

### Before (Problematic)

```typescript
{
  id: "base",
  adjacency: {
    up: ["air"],                        // Too restrictive!
    down: ["cube", "cylinder", "base"], // Confusing (nothing below ground?)
    north: ["base", "cylinder"],
    south: ["base", "cylinder"],
    east: ["base", "cylinder"],
    west: ["base", "cylinder"],
  }
}
```

### After (Recommended)

```typescript
{
  id: "base",
  adjacency: {
    up: ["air", "empty", "block", "cube", "cylinder"],  // All tiles that can sit on ground
    // down: omit entirely for no restrictions (all tiles allowed below)
    north: ["base", "cylinder", "air", "empty"],
    south: ["base", "cylinder", "air", "empty"],
    east: ["base", "cylinder", "air", "empty"],
    west: ["base", "cylinder", "air", "empty"],
  }
}

// OR if you truly want nothing below (rare):
{
  id: "floating_platform",
  adjacency: {
    up: ["player", "item"],
    down: [],  // ⚠️ STRICT: Nothing allowed below (will limit placement!)
    // ... other directions
  }
}
```

**And ensure reciprocity:**

```typescript
{
  id: "block",  // or cube, cylinder, etc.
  adjacency: {
    down: ["base", "block", "empty"],  // ✅ Must include "base"!
    // ... other directions
  }
}
```

## Quick Checklist

For each tile in your tileset:

1. ✅ List all tiles it should connect to in each direction
2. ✅ For each connection, verify the reverse connection exists
3. ✅ Use `[]` or omit directions for "no restrictions"
4. ✅ Never create one-way connections
5. ✅ Run the validator - it will catch asymmetry errors

## Testing Your Tileset

```typescript
import { validateTileset } from "three-collapse";

const validation = validateTileset(myTiles);

if (!validation.valid) {
  console.error("❌ Tileset has errors:");
  for (const issue of validation.issues) {
    console.log(`  ${issue.message}`);
  }

  console.log("\n💡 Suggestions:");
  for (const suggestion of validation.suggestions) {
    console.log(`  - ${suggestion}`);
  }
}
```

## Common Patterns

### Ground Tiles

```typescript
{
  id: "ground",
  adjacency: {
    up: ["block", "tree", "air"],  // Things that sit on ground
    // down: omitted - no restrictions (foundation can rest on anything)
    north: ["ground", "air"],       // Can extend horizontally
    south: ["ground", "air"],
    east: ["ground", "air"],
    west: ["ground", "air"],
  }
}
```

### Air/Empty Tiles (Flexible)

```typescript
{
  id: "air",
  weight: 10,  // High weight for flexibility
  adjacency: {
    // Omit all directions = no restrictions at all
    // Can be adjacent to anything in any direction
  }
}

// OR be explicit:
{
  id: "air",
  weight: 10,
  adjacency: {
    up: ["air", "block", "tree"],    // List all possible tiles
    down: ["air", "ground", "block"],
    // ... etc
  }
}
```

### Structural Tiles (Specific)

```typescript
{
  id: "wall",
  adjacency: {
    up: ["wall", "roof"],
    down: ["wall", "ground", "foundation"],
    north: ["wall", "window", "door"],
    south: ["wall", "window", "door"],
    east: ["wall", "window", "door"],
    west: ["wall", "window", "door"],
  }
}
```

## Debugging Tips

### Check Validation on Startup

The demo automatically validates - check your console for errors:

```
⚠️ Tileset validation found issues:
❌ ASYMMETRY: 'base' allows 'block' in up direction, but 'block'
   does NOT allow 'base' in down direction...
```

### Fix Systematically

1. Start with the first asymmetry error
2. Fix both sides of the connection
3. Re-run validation
4. Repeat until all errors are gone

### Use Explicit Lists

Rather than relying on `[]` everywhere, be explicit about what should connect:

```typescript
// Clear and explicit
up: ["block", "air", "empty"];

// Less clear (but valid)
up: [];
```

## Summary

✅ **Omit directions for "no restrictions"** (all tiles allowed)
✅ **Empty arrays `[]` = NO tiles allowed** (strict restriction)
✅ **Symmetry is REQUIRED** - validated as errors
✅ **Fix all asymmetry errors** before generating
✅ **The validator will guide you** with specific fix suggestions

With these rules:

- Your base tile's `down: []` means "nothing allowed below" (very restrictive!)
- To allow anything below, **omit** the `down` property entirely
- Be explicit about what connects where for best results
