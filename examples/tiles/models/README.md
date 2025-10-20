# Example Tilesets

This directory contains example tilesets demonstrating both legacy adjacency-based and new connector-based configurations.

## Usage

### Quick Start (Auto-Conversion)

```typescript
import { mixedModelTileset } from "./tileset";
import { WFCGenerator } from "three-collapse";

// The tileset is auto-converted from adjacency to connectors
const generator = new WFCGenerator(mixedModelTileset, options);
await generator.generate();
```

### How Auto-Conversion Works

The example tilesets in `tileset.ts` are defined using the legacy adjacency format but are automatically converted to the new connector-based format using the `convertAdjacencyToConnectors` helper:

```typescript
// Raw tileset (legacy adjacency format)
const mixedModelTilesetRaw = [
  {
    id: "base",
    model: "/models/base.glb",
    adjacency: {
      up: ["air"],
      down: ["cube", "cylinder"],
      // ...
    },
  },
];

// Auto-converted to connectors on export
export const mixedModelTileset =
  convertAdjacencyToConnectors(mixedModelTilesetRaw);
```

## Available Tilesets

### `simpleModelTileset`

- **Tiles**: block, base, air (3 tiles)
- **Best for**: Learning and simple tests
- **Format**: Auto-converted from adjacency

### `mixedModelTileset`

- **Tiles**: base, halfpipe, quater-pipe, bump, cube, cylinder, air (7 tiles)
- **Best for**: Demonstrations and prototyping
- **Format**: Auto-converted from adjacency
- **Features**: Mix of GLB models and procedural geometry

### `blockTileset`

- **Tiles**: handrail-entrance, corner-inverted, spiral-staircase variants, square-roof (5 tiles)
- **Best for**: Architectural structures
- **Format**: Auto-converted from adjacency

## For Production Use

⚠️ **These auto-converted tilesets use permissive defaults and may not behave exactly as intended.**

For production projects, we recommend:

1. **Use ConnectorBuilderUI** to create proper connector-based tilesets
2. **Fine-tune connectors** with appropriate symmetry (`flipped`/`not-flipped`/`symmetric`) and rotation (0-3/`invariant`)
3. **Set up exclusions** for precise tile compatibility control

See the [ConnectorBuilderUI documentation](../../../docs/CONNECTOR_BUILDER.md) for the recommended workflow.

## Understanding the Conversion

The `convertAdjacencyToConnectors` helper:

- ✅ Analyzes adjacency patterns and creates connector groups
- ✅ Converts exclusion rules (`Ex` suffixes) to bidirectional exclusions
- ✅ Sets permissive defaults (`symmetric`/`invariant`) for maximum compatibility
- ❌ Cannot infer specific rotation values (0-3) from adjacency alone
- ❌ Cannot determine optimal symmetry values (`flipped` vs `not-flipped`)

For more details, see [Adjacency Converter Documentation](../../../docs/ADJACENCY_CONVERTER.md).

## Legacy Versions

Each tileset also exports a `_Legacy` version with the raw adjacency data:

```typescript
import {
  mixedModelTileset, // Connector-based (use this)
  mixedModelTilesetRaw_Legacy, // Raw adjacency (for reference only)
} from "./tileset";
```

The `_Legacy` versions are provided for reference only and will **NOT** work with the new WFC system.
