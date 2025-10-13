# Type Safety Update - Mutual Exclusivity Enforcement

## Overview

TypeScript now **enforces at compile-time** that you cannot mix inclusive and exclusive adjacency rules for the same direction. This prevents configuration errors before runtime.

## What Changed

### Before

Previously, you could technically write this (though the runtime would ignore `upEx`):

```typescript
{
  id: "confusing",
  adjacency: {
    up: ["air"],      // Runtime would use this
    upEx: ["solid"]   // Runtime would ignore this
  }
}
```

### After

Now TypeScript **prevents** this at compile time:

```typescript
{
  id: "confusing",
  adjacency: {
    up: ["air"],      // ❌ TypeScript Error
    upEx: ["solid"]   // ❌ Cannot specify both
  }
}
```

## How It Works

The `AdjacencyRules` type uses union types to enforce mutual exclusivity:

```typescript
type UpRule =
  | { up?: string[]; upEx?: never }    // Can have up, but upEx must be absent
  | { up?: never; upEx?: string[] };   // Can have upEx, but up must be absent

type AdjacencyRules = UpRule & DownRule & NorthRule & ...
```

For each direction, you get a union of three possibilities:

1. Only inclusive rule (`up` defined, `upEx` is `never`)
2. Only exclusive rule (`upEx` defined, `up` is `never`)
3. Neither rule (both optional/undefined)

## Valid Patterns

### ✅ Only Inclusive

```typescript
adjacency: {
  up: ["air", "sky"];
}
```

### ✅ Only Exclusive

```typescript
adjacency: {
  upEx: ["solid", "metal"];
}
```

### ✅ Mix on Different Directions

```typescript
adjacency: {
  up: ["air"],        // Inclusive
  downEx: ["air"],    // Exclusive
  north: ["wall"],    // Inclusive
  southEx: ["lava"]   // Exclusive
}
```

### ✅ Omit Directions

```typescript
adjacency: {
  up: ["air"];
  // down omitted = no restrictions
}
```

## Invalid Patterns

### ❌ Both Rules Same Direction

```typescript
adjacency: {
  up: ["air"],      // ❌ TypeScript Error
  upEx: ["solid"]   // Cannot specify both
}
```

### ❌ Multiple Violations

```typescript
adjacency: {
  up: ["air"],
  upEx: ["solid"],    // ❌ Error
  down: ["ground"],
  downEx: ["air"]     // ❌ Error
}
```

## TypeScript Error Messages

When you violate the mutual exclusivity, TypeScript shows helpful errors:

```
Type '{ up: string[]; upEx: string[]; }' is not assignable to type 'AdjacencyRules'.
  Types of property 'upEx' are incompatible.
    Type 'string[]' is not assignable to type 'never'.
```

This clearly indicates that you can't have both `up` and `upEx`.

## Migration Guide

If you have existing code that mixed rules:

### Step 1: Identify Violations

Look for tiles where both `direction` and `directionEx` are specified:

```typescript
// Find patterns like this:
adjacency: {
  up: [...],
  upEx: [...]   // ← Violation
}
```

### Step 2: Choose One

Decide which rule you actually want:

```typescript
// Option 1: Keep inclusive
adjacency: {
  up: ["air", "sky"];
  // Remove upEx
}

// Option 2: Keep exclusive
adjacency: {
  // Remove up
  upEx: ["solid", "metal"];
}
```

### Step 3: Test

Generate grids and verify the behavior matches expectations.

## Benefits

### 1. Catch Errors Early

❌ Before: Runtime ignores one rule silently  
✅ Now: TypeScript error at compile time

### 2. Better Developer Experience

Clear error messages guide you to fix issues immediately

### 3. Safer Refactoring

TypeScript ensures you don't accidentally introduce mixed rules

### 4. Self-Documenting Code

The type system makes it clear that rules are mutually exclusive

## Examples

### Example 1: Simple Platform

```typescript
const platform: ModelTile3DConfig = {
  id: "platform",
  model: "/models/platform.glb",
  adjacency: {
    downEx: ["air"], // ✓ Valid - can't float
  },
};
```

### Example 2: Roof Tile

```typescript
const roof: ModelTile3DConfig = {
  id: "roof",
  model: "/models/roof.glb",
  adjacency: {
    up: ["air", "sky"], // ✓ Valid - inclusive
    downEx: ["air", "water"], // ✓ Valid - exclusive on different direction
  },
};
```

### Example 3: Invalid Configuration

```typescript
const invalid: ModelTile3DConfig = {
  id: "invalid",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"],
    upEx: ["solid"], // ❌ TypeScript Error!
    //  ^^^^^^^
    //  Cannot specify both up and upEx
  },
};
```

## Testing Type Safety

We've included a test file demonstrating the type safety:

```bash
# This file will compile successfully:
examples/tiles/models/type-safety-test.ts

# Uncomment the invalid examples to see TypeScript errors
```

## Comparison

| Feature                 | Before            | After                                      |
| ----------------------- | ----------------- | ------------------------------------------ |
| **Compile-time safety** | ❌ No enforcement | ✅ Enforced by TypeScript                  |
| **Error detection**     | Runtime (silent)  | Compile-time (explicit)                    |
| **Developer feedback**  | None              | Clear error messages                       |
| **Breaking changes**    | -                 | None (if already following best practices) |

## FAQs

**Q: Will this break my existing code?**  
A: Only if you were specifying both `up` and `upEx` for the same direction, which was already a mistake (one would be ignored).

**Q: Can I still mix inclusive and exclusive rules?**  
A: Yes! You can use inclusive for some directions and exclusive for others. You just can't use both for the **same** direction.

**Q: What if I need complex logic?**  
A: Use exclusive rules for simpler "not these" logic. For complex cases, carefully craft your inclusive rule list.

**Q: Does this affect performance?**  
A: No. This is a compile-time type check only. Runtime behavior is unchanged.

## Summary

✅ **Type-safe** - Can't mix up/upEx on same direction  
✅ **Compile-time** - Errors caught immediately  
✅ **Clear errors** - TypeScript guides you to fix  
✅ **No breaking changes** - Valid code still works  
✅ **Better DX** - Safer refactoring and clearer intent

The type system now accurately reflects the runtime behavior: you can have **either** inclusive **or** exclusive rules per direction, not both.
