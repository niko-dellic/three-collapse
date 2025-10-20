# Connector-Based WFC System Migration - Implementation Summary

## Overview

Successfully migrated the Wave Function Collapse system from explicit adjacency arrays to connector-based compatibility checks, following the Marian42 blog post approach. Adjacencies are now computed dynamically during collapse based on connector group matching, symmetry/rotation rules, and exclusions.

## ✅ Completed Changes

### 1. Type System Updates

#### `src/types/index.d.ts`

- **Added** new connector-related types:
  - `ConnectorData`: Defines groupId, symmetry (for horizontal faces), and rotation (for vertical faces)
  - `TileConnectors`: Container for all six face connectors
  - `DirectionalExclusion`: Defines directional exclusion rules

#### `src/wfc3d/WFCTile3D.ts`

- **Replaced** adjacency-based system with connector-based system
- **Removed** old adjacency map processing logic
- **Added** connector compatibility checking methods:
  - `getConnector(direction)`: Get connector for a specific face
  - `isConnectorCompatible()`: Check if two connectors can connect based on groupId, symmetry, and rotation
  - `canBeAdjacentTo()`: Check tile compatibility including both connectors and exclusions (bidirectional)
- **Added** `DIRECTION_NAMES` constant for direction name mapping
- **Made** `connectors` optional in `BaseTile3DConfig` for backward compatibility with legacy tools
- **Added** `LegacyAdjacencyRules` type to support old AdjacencyBuilderUI
- **Added** validation in constructor to ensure connectors are defined when creating WFCTile3D

### 2. Core Algorithm Updates

#### `src/wfc3d/WFC3D.ts`

- **Updated** `propagate()` method to use dynamic connector-based filtering
- **Replaced** explicit adjacency lookups with calls to `tile.canBeAdjacentTo(candidateTile, dir)`
- **Updated** expansion constraint propagation to use the same connector-based logic
- **Removed** all references to `tile.adjacency` and `tile.adjacencyExclusive` maps

### 3. Worker System

#### `src/wfc.worker.ts`

- Worker message types automatically updated to handle `ModelTile3DConfig` with connectors
- No explicit changes needed as it constructs WFCTile3D from configs (which now require connectors)

### 4. Utility Updates

#### `src/utils/TileHelpers.ts`

- **Replaced** `validateTileAdjacency()` with `validateTileExclusions()`
- **Updated** `prepareTilesForWorker()` to pass connectors and exclusions instead of adjacency
- **Updated** `gltfObjectToTiles()` to read `connectors` and `exclusions` from mesh userData
- **Added** warning when mesh lacks connectors

#### `src/utils/TilesetValidator.ts`

- **Completely rewritten** to validate connector structure instead of adjacency
- **New validation checks**:
  - Ensures all tiles have connectors
  - Validates connector structure per face (groupId, symmetry for horizontal, rotation for vertical)
  - Checks exclusions reference existing tiles
  - Detects isolated tiles (no compatible neighbors via connectors)
  - Checks reachability through connector compatibility
- **Updated** `checkReachability()` to use connector compatibility graph
- **Updated** `getCompatibilityMatrix()` to use `tile.canBeAdjacentTo()`

#### `src/loaders/GLBAdjacencyLoader.ts`

- **Updated** to load connector and exclusion data from GLB userData
- **Replaced** adjacency extraction with connector extraction
- **Added** `LoadedTileData` interface for loaded tile metadata
- **Updated** all methods to work with connector-based configs

#### `src/utils/ConnectorBuilderUI.ts`

- **Updated** `handleExclusionClick()` to add **bidirectional exclusions**
  - Forward exclusion: sourceTile cannot be [direction] of targetTile
  - Reverse exclusion: targetTile cannot be [oppositeDir] of sourceTile
- **Added** `getOppositeDirection()` helper method
- **Removed** auto-generate adjacencies functionality:
  - Removed "Auto-Generate Adjacencies" button from UI
  - Removed `autoGenerateAdjacencies()` method
  - Removed `canConnect()`, `checkRotationCompatibility()`, `checkSymmetryCompatibility()`, and `hasExclusion()` helper methods
  - These are now handled by `WFCTile3D.canBeAdjacentTo()`
- **Removed** JSConfetti import and usage (was only used for auto-generate)
- **Updated** exports to include connector and exclusion data
- Adjacency data is still exported for reference but is **not used** by the WFC system

### 5. Export Updates

#### `src/wfc3d/index.ts`

- **Added** re-exports for `ConnectorData`, `TileConnectors`, `DirectionalExclusion` from `../types`

#### `src/utils/index.ts`

- **Replaced** `validateTileAdjacency` export with `validateTileExclusions`

#### `src/index.ts`

- **Replaced** `validateTileAdjacency` export with `validateTileExclusions`

### 6. Example Updates

#### `examples/tiles/models/tileset.ts`

- **Updated** imports to use `validateTileExclusions`
- **Added** warning comment that these are **legacy examples** using old adjacency system
- **Removed** validation calls (tilesets export raw configs)
- These examples will **NOT** work with the new connector-based WFC generator

## How It Works

### Connector Compatibility Rules

The new system checks compatibility dynamically during WFC collapse:

1. **Group ID Matching**: Connectors must have the same `groupId` to connect
2. **Vertical Faces (up/down)**: Check `rotation` compatibility
   - `"invariant"` matches with any rotation
   - Otherwise, rotation values (0-3) must match exactly
3. **Horizontal Faces (north/south/east/west)**: Check `symmetry` compatibility
   - `"symmetric"` matches with any symmetry
   - `"flipped"` matches with `"not-flipped"` and vice versa
4. **Exclusions**: Bidirectional checks for both forward and reverse exclusions

### Migration from Old System

**Old System (Explicit Adjacency)**:

```typescript
{
  id: "floor",
  adjacency: {
    up: ["wall", "air"],
    down: ["foundation"],
    // ...
  }
}
```

**New System (Connectors)**:

```typescript
{
  id: "floor",
  connectors: {
    up: { groupId: "floor_top", symmetry: "symmetric" },
    down: { groupId: "solid", rotation: "invariant" },
    north: { groupId: "floor_side", symmetry: "symmetric" },
    south: { groupId: "floor_side", symmetry: "symmetric" },
    east: { groupId: "floor_side", symmetry: "symmetric" },
    west: { groupId: "floor_side", symmetry: "symmetric" }
  },
  exclusions: [
    { targetTileId: "wall", direction: "up" }
  ]
}
```

## Backward Compatibility

- **AdjacencyBuilderUI**: Remains functional as a legacy tool but generates configs that won't work with the new WFC system
- **Legacy adjacency field**: Still allowed in `ModelTile3DConfig` but **not used** by WFC3D
- **Connectors required**: WFCTile3D constructor throws an error if connectors are not defined
- **Old examples**: Marked as legacy and will not work with the new system

## Performance Considerations

- Dynamic filtering is O(N) per cell collapse where N = total tiles
- For large tilesets (>100 tiles), monitor performance
- Can add optional pre-computed lookup cache as optimization if needed

## Testing Recommendations

1. Test with simple tileset (2-3 tiles) using ConnectorBuilderUI
2. Test with complex tileset from ConnectorBuilderUI
3. Verify bidirectional exclusions work correctly
4. Check that connector compatibility logic matches blog post behavior
5. Validate that legacy examples fail gracefully with clear error messages

## Backward Compatibility Helper

### `convertAdjacencyToConnectors()`

A new helper function was created to provide backward compatibility for legacy adjacency-based tilesets:

```typescript
import { convertAdjacencyToConnectors } from "three-collapse";

// Old adjacency-based tileset
const legacyTileset = [
  { id: "floor", adjacency: { up: ["wall"], down: [] }, ... }
];

// Convert to connector-based format
const connectorTileset = convertAdjacencyToConnectors(legacyTileset);
```

**How it works:**

1. Analyzes adjacency patterns and creates connector groups
2. Assigns same groupId to tiles with identical adjacency patterns
3. Sets permissive defaults (`symmetric`/`invariant`) for maximum compatibility
4. Converts exclusion rules (`Ex` suffixes) to bidirectional exclusions

**Limitations:**

- Uses permissive defaults (may allow unintended adjacencies)
- Cannot infer specific rotation values (0-3) from adjacency
- Cannot determine optimal symmetry values (`flipped`/`not-flipped`)

**Recommendation:** Use ConnectorBuilderUI for production tilesets. The converter is best for quick migration and testing.

See [Adjacency Converter Documentation](./docs/ADJACENCY_CONVERTER.md) for details.

## Files Modified

- `src/types/index.d.ts` - New connector types
- `src/wfc3d/WFCTile3D.ts` - Connector-based tile class
- `src/wfc3d/WFC3D.ts` - Dynamic connector filtering
- `src/wfc3d/index.ts` - Export connector types
- `src/utils/TileHelpers.ts` - Connector validation and worker prep
- `src/utils/TilesetValidator.ts` - Connector validation
- `src/utils/ConnectorBuilderUI.ts` - Bidirectional exclusions, remove auto-generate
- `src/loaders/GLBAdjacencyLoader.ts` - Connector loading
- `src/utils/AdjacencyConverter.ts` - **NEW**: Backward compatibility helper
- `src/utils/index.ts` - Export updates
- `src/index.ts` - Export updates
- `examples/tiles/models/tileset.ts` - Auto-conversion using helper
- `examples/models/demo.ts` - Updated comments
- `docs/ADJACENCY_CONVERTER.md` - **NEW**: Converter documentation
- `examples/tiles/models/README.md` - **NEW**: Example usage guide

## Next Steps

1. Update documentation to reflect connector-based system
2. Create new example tilesets using ConnectorBuilderUI
3. Add performance benchmarks for large tilesets
4. Consider optional pre-computed lookup cache if performance issues arise
5. Update tutorials and guides to use the new connector workflow
