# Adjacency to Connector Conversion Helper

## Overview

The `convertAdjacencyToConnectors` helper function provides backward compatibility for legacy adjacency-based tilesets, allowing them to work with the new connector-based WFC system.

## Usage

```typescript
import { convertAdjacencyToConnectors } from "three-collapse";

// Old adjacency-based tileset
const legacyTileset = [
  {
    id: "floor",
    model: "/models/floor.glb",
    adjacency: {
      up: ["wall", "air"],
      down: ["foundation"],
      north: ["floor", "wall"],
      // ...
    },
  },
  // ... more tiles
];

// Convert to connector-based format
const connectorTileset = convertAdjacencyToConnectors(legacyTileset);

// Now compatible with new WFC system
const generator = new WFCGenerator(connectorTileset, options);
```

## How It Works

### Pattern-Based Grouping

The converter analyzes adjacency patterns across all tiles and creates connector groups:

1. **Pattern Analysis**: For each direction, tiles with identical adjacency rules get the same groupId
2. **Group Assignment**: Tiles sharing adjacency patterns share connector groups
3. **Permissive Defaults**: Sets `symmetric` (horizontal) and `invariant` (vertical) for maximum compatibility
4. **Exclusion Generation**: Converts `Ex` rules (e.g., `upEx: ["tile1"]`) to bidirectional exclusions

### Conversion Strategy

#### Inclusive Rules (Specific Tiles Allowed)

```typescript
// Input
adjacency: {
  up: ["wall", "air"]
}

// Output
connectors: {
  up: {
    groupId: "group_0",  // Shared by all tiles with same up: ["wall", "air"]
    rotation: "invariant"
  }
}
```

#### Exclusive Rules (Specific Tiles Excluded)

```typescript
// Input
adjacency: {
  northEx: ["tile1", "tile2"]
}

// Output
connectors: {
  north: {
    groupId: "group_1",
    symmetry: "symmetric"
  }
},
exclusions: [
  { targetTileId: "tile1", direction: "north" },
  { targetTileId: "tile2", direction: "north" }
]
```

#### Base Rules (Apply to All Faces)

```typescript
// Input
adjacency: {
  all: ["floor", "wall"],
  up: ["air"]  // Overrides base for up direction
}

// Output
connectors: {
  up: { groupId: "group_0", rotation: "invariant" },      // Specific rule
  down: { groupId: "group_1", rotation: "invariant" },    // Base rule
  north: { groupId: "group_1", symmetry: "symmetric" },   // Base rule
  south: { groupId: "group_1", symmetry: "symmetric" },   // Base rule
  east: { groupId: "group_1", symmetry: "symmetric" },    // Base rule
  west: { groupId: "group_1", symmetry: "symmetric" }     // Base rule
}
```

## Important Notes

### Limitations

1. **Permissive Defaults**: The converter uses the most permissive settings (`symmetric`/`invariant`), which may allow more adjacencies than intended
2. **Pattern Matching**: Only exact adjacency patterns create shared groups
3. **No Rotation Control**: Cannot infer specific rotation values (0-3) from adjacency alone
4. **No Symmetry Control**: Cannot determine if `flipped`/`not-flipped` is more appropriate

### When to Use

✅ **Good for:**

- Quick migration of existing adjacency-based tilesets
- Testing and prototyping with legacy tilesets
- Maintaining backward compatibility in existing projects

❌ **Not recommended for:**

- Production tilesets requiring fine-grained control
- Tilesets with complex symmetry/rotation requirements
- New projects (use ConnectorBuilderUI instead)

## Example Migration

### Before (Legacy Adjacency)

```typescript
const tileset = [
  {
    id: "floor",
    model: "/models/floor.glb",
    weight: 5,
    adjacency: {
      up: ["wall", "air"],
      down: ["foundation"],
      all: ["floor"], // Base rule for remaining directions
    },
  },
  {
    id: "wall",
    model: "/models/wall.glb",
    weight: 3,
    adjacency: {
      up: ["roof", "air"],
      down: ["floor", "wall"],
      allEx: ["foundation"], // Exclude foundation from all faces
    },
  },
];
```

### After (Auto-Converted)

```typescript
const tileset = convertAdjacencyToConnectors([
  // ... same as above
]);

// Result:
// [
//   {
//     id: "floor",
//     connectors: {
//       up: { groupId: "group_0", rotation: "invariant" },
//       down: { groupId: "group_1", rotation: "invariant" },
//       north: { groupId: "group_2", symmetry: "symmetric" },
//       south: { groupId: "group_2", symmetry: "symmetric" },
//       east: { groupId: "group_2", symmetry: "symmetric" },
//       west: { groupId: "group_2", symmetry: "symmetric" }
//     },
//     exclusions: []
//   },
//   {
//     id: "wall",
//     connectors: { /* ... */ },
//     exclusions: [
//       { targetTileId: "foundation", direction: "up" },
//       { targetTileId: "foundation", direction: "down" },
//       { targetTileId: "foundation", direction: "north" },
//       // ... for all directions
//     ]
//   }
// ]
```

## Best Practices

### For Migration

1. **Convert and Test**: Convert your tileset and test with a small grid first
2. **Validate Results**: Use `validateTileset()` to check for issues
3. **Monitor Behavior**: Watch for unexpected adjacencies due to permissive defaults
4. **Refine if Needed**: For critical tilesets, manually create connectors using ConnectorBuilderUI

### For New Projects

**Do NOT use the converter for new projects.** Instead:

1. Use **ConnectorBuilderUI** to create proper connector-based tilesets
2. Define connectors with appropriate symmetry and rotation values
3. Take advantage of the blog post's full connector system
4. Get better control over tile compatibility

## API Reference

### `convertAdjacencyToConnectors(configs)`

Converts legacy adjacency-based tile configs to connector-based configs.

**Parameters:**

- `configs: ModelTile3DConfig[]` - Array of tiles with adjacency rules

**Returns:**

- `ModelTile3DConfig[]` - Array of tiles with connectors and exclusions

**Throws:**

- Error if a tile has no adjacency rules

### `needsConnectorConversion(configs)`

Checks if a tileset needs conversion.

**Parameters:**

- `configs: ModelTile3DConfig[]` - Array of tile configs

**Returns:**

- `boolean` - `true` if any tile lacks connectors but has adjacency

**Example:**

```typescript
if (needsConnectorConversion(myTileset)) {
  myTileset = convertAdjacencyToConnectors(myTileset);
}
```

## See Also

- [ConnectorBuilderUI Documentation](./CONNECTOR_BUILDER.md) - Recommended for new tilesets
- [Marian42's WFC Blog](https://marian42.de/article/wfc/) - The connector system explained
- [Migration Summary](../CONNECTOR_MIGRATION_SUMMARY.md) - Full migration guide
