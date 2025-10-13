# Changelog: Exclusion Adjacency Feature

## Version: Next Release

**Date**: October 13, 2025
**Feature**: Negative Gate Logic / Exclusion Adjacency Rules

---

## Summary

Added support for **exclusive adjacency rules** to complement the existing inclusive rules. You can now specify which tiles should be **excluded** from adjacency rather than which should be **included**.

## What Changed

### New Properties Added to `BaseTile3DConfig`

```typescript
adjacency?: {
  // Existing inclusive rules
  up?: string[];
  down?: string[];
  north?: string[];
  south?: string[];
  east?: string[];
  west?: string[];

  // NEW: Exclusive rules
  upEx?: string[];      // All tiles EXCEPT these can be above
  downEx?: string[];    // All tiles EXCEPT these can be below
  northEx?: string[];   // All tiles EXCEPT these can be to the north
  southEx?: string[];   // All tiles EXCEPT these can be to the south
  eastEx?: string[];    // All tiles EXCEPT these can be to the east
  westEx?: string[];    // All tiles EXCEPT these can be to the west
}
```

### Modified Classes

#### `WFCTile3D`

- Added `adjacencyExclusive: Map<number, Set<string>>` property
- Updated constructor to process `*Ex` rules
- Modified `canBeAdjacentTo()` to check exclusive rules

#### `WFC3D`

- Updated `propagate()` method to handle exclusive adjacency
- Updated `expand()` method's constraint propagation to handle exclusive adjacency

### Files Modified

1. **src/wfc3d/WFCTile3D.ts**

   - Updated `BaseTile3DConfig` interface
   - Added `adjacencyExclusive` Map
   - Updated constructor logic
   - Enhanced `canBeAdjacentTo()` method

2. **src/wfc3d/WFC3D.ts**
   - Updated constraint propagation in `propagate()`
   - Updated constraint propagation in `expand()`

### Documentation Added

1. **docs/ADJACENCY_EXCLUSION.md**

   - Complete guide to using exclusive rules
   - Examples and patterns
   - Performance considerations
   - Migration guide

2. **examples/tiles/models/exclusion-example.ts**
   - Practical examples demonstrating exclusive adjacency
   - Comparison with inclusive-only approach
   - Usage tips and best practices

## Breaking Changes

**None**. This is a fully backward-compatible addition.

- Existing tilesets work without modification
- Inclusive rules (`up`, `down`, etc.) work exactly as before
- Only new `*Ex` properties add functionality

## Usage Examples

### Before (Inclusive Only)

```typescript
{
  id: "platform",
  model: "/models/platform.glb",
  adjacency: {
    // Had to list every possible support tile
    down: ["ground", "foundation", "wall", "block", "stone", "wood", ...]
  }
}
```

### After (With Exclusive)

```typescript
{
  id: "platform",
  model: "/models/platform.glb",
  adjacency: {
    // Simply exclude air - everything else is allowed
    downEx: ["air"]
  }
}
```

### Mixed Usage

```typescript
{
  id: "special_tile",
  model: "/models/special.glb",
  adjacency: {
    up: ["air", "ceiling"],      // Inclusive: only these above
    downEx: ["air", "water"],    // Exclusive: not air or water below
    northEx: ["lava"]            // Exclusive: not lava to the north
  }
}
```

## How It Works

### Precedence Rules

1. If an **inclusive rule** is specified for a direction, it takes precedence
2. If only an **exclusive rule** is specified, it's used with inverted logic
3. If neither is specified, all tiles are allowed

### Logic Flow

```typescript
// Checking if tileA can be adjacent to tileB in direction "up"

// 1. Check inclusive rule first
if (tileA.adjacency.has(UP)) {
  return tileA.adjacency.get(UP).has(tileB.id); // Must be in allow list
}

// 2. Check exclusive rule
if (tileA.adjacencyExclusive.has(UP)) {
  return !tileA.adjacencyExclusive.get(UP).has(tileB.id); // Must NOT be in deny list
}

// 3. No rules = all allowed
return true;
```

## Performance Impact

**Minimal**. The only difference is:

- **Inclusive**: `O(1)` Set lookup
- **Exclusive**: `O(T)` where T = number of tiles in tileset (only when checking exclusive rules)

In practice, exclusive rules are typically used with small exclusion lists on large tilesets, making them very efficient.

## Testing

### Automated Tests

- All existing tests pass
- Build completes successfully
- No TypeScript errors
- No linter warnings

### Manual Testing Recommended

1. Create a tileset with exclusive rules
2. Generate a grid and verify tile placement
3. Test mixed inclusive/exclusive rules
4. Verify precedence (inclusive over exclusive)

## Migration Path

No migration needed! But if you want to optimize your tilesets:

### Step 1: Identify Verbose Inclusive Rules

Look for adjacency rules listing many tiles:

```typescript
down: ["tile1", "tile2", "tile3", "tile4", "tile5", "tile6", "tile7", "tile8"];
```

### Step 2: Convert to Exclusive if Appropriate

If it's easier to list what's NOT allowed:

```typescript
downEx: ["air", "lava"]; // Much simpler!
```

### Step 3: Test

Generate grids and verify the behavior matches expectations.

## Future Enhancements

Potential future additions based on this foundation:

1. **Pattern matching**: `upEx: ["*_wall"]` to exclude all wall types
2. **Category exclusion**: `downEx: ["@liquids"]` to exclude tile categories
3. **Conditional exclusion**: More complex rule expressions
4. **Visual editor**: GUI tool to define exclusion rules

## Questions & Answers

**Q: Can I use both `up` and `upEx` on the same tile?**
A: Yes, but the inclusive rule (`up`) takes precedence and `upEx` is ignored for that direction.

**Q: Does this work with the expansion feature?**
A: Yes! Both `propagate()` and `expand()` methods support exclusive rules.

**Q: What happens if I put `upEx: []` (empty array)?**
A: Empty exclusion means "exclude nothing" = all tiles are allowed.

**Q: Is this slower than inclusive rules?**
A: Slightly, but only when exclusive rules are actually used. The difference is negligible for typical tilesets (<100 tiles).

**Q: Can I mix inclusive and exclusive rules on the same tile?**
A: Yes! Use inclusive for some directions and exclusive for others:

```typescript
adjacency: {
  up: ["air"],          // Inclusive
  downEx: ["air"],      // Exclusive
  north: ["wall"]       // Inclusive
}
```

## Credits

Feature requested by: User
Implemented by: AI Assistant
Date: October 13, 2025

---

## Next Steps

1. Update main README.md with mention of exclusive rules
2. Add to API documentation
3. Create tutorial video/example
4. Add to package release notes
