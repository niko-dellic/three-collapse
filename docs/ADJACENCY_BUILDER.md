# Adjacency Builder Tool

The Adjacency Builder is a visual tool for defining tile adjacencies in your WFC tileset. It provides an intuitive interface for reviewing tile pairs and setting up their spatial relationships.

## Overview

Building correct adjacency rules is crucial for Wave Function Collapse to generate valid patterns. The Adjacency Builder simplifies this process by:

- **Visual Inspection**: View 3D previews of tile pairs side-by-side
- **Symmetric Relationships**: Automatically enforces symmetry (if A can be north of B, then B can be south of A)
- **Progress Tracking**: Tracks which pairs you've reviewed to avoid duplicates
- **Multiple Export Formats**: Export to JSON or GLB with embedded adjacency data

## Getting Started

1. Navigate to `http://localhost:5173/adjacency-builder.html` in your browser
2. Choose your input mode:
   - **Auto-discover**: Loads all GLB files from `/public/models/blocks/`
   - **Upload Files**: Select multiple GLB files from your computer
   - **Continue from Existing**: Import an existing tileset to review/add adjacencies
3. Click **Start** to begin

## Usage Workflow

### Step 1: Review Tile Pairs

For each pair of tiles, you'll see:

- **Tile A** (blue tint) on the left
- **Tile B** (red tint) on the right
- Current pair number and total pairs
- Weight input for Tile B

### Step 2: Set Adjacencies

Check the direction boxes to indicate which spatial relationships are valid:

- **Up**: Tile B can be directly above Tile A
- **Down**: Tile B can be directly below Tile A
- **North**: Tile B can be north of Tile A (+Z direction)
- **South**: Tile B can be south of Tile A (-Z direction)
- **East**: Tile B can be east of Tile A (+X direction)
- **West**: Tile B can be west of Tile A (-X direction)

**Note**: The opposite relationship is automatically set (symmetry enforcement)

### Step 3: Navigate

- **Next/Previous**: Move between pairs sequentially
- **Auto-advance**: Automatically move to the next pair after setting adjacencies
- **Quick Navigation**: Jump to any pair using the numbered buttons
- **Skip**: Skip a pair without setting any adjacencies

### Step 4: Review & Export

The review panel shows all tiles with their current adjacency rules. You can:

- **Download JSON**: Export as `ModelTile3DConfig[]` format ready to use in your code
- **Download GLB**: Export as a GLB file with adjacency data in `userData`

## Input Modes

### Auto-discover Mode

Automatically loads all GLB files from the blocks directory:

```typescript
// Uses Vite's import.meta.glob
const glbFiles = import.meta.glob("/public/models/blocks/*.glb");
```

Best for: Starting fresh with a new tileset

### Upload Mode

Select multiple GLB files from your file system.

Best for: Working with tiles not in the project directory

### Continue Mode

Loads an existing `ModelTile3DConfig[]` array and:

1. Imports existing adjacency rules
2. Detects "new" tiles (not referenced anywhere and with no adjacencies)
3. Only generates pairs involving at least one new tile

Best for: Adding new tiles to an existing tileset

## Export Formats

### JSON Export

Exports as an array of `ModelTile3DConfig` objects:

```typescript
[
  {
    id: "spiral-staircase",
    weight: 1,
    model: "/models/blocks/spiral-staircase.glb",
    adjacency: {
      up: ["air"],
      west: ["spiral-staircase-inverted"],
      // ... other directions
    },
  },
  // ... more tiles
];
```

You can directly copy this into your tileset file or import it.

### GLB Export

Creates a single GLB file containing:

- All tiles arranged in a grid layout
- Each tile's ID and weight in its `userData`
- Complete adjacency configuration in the scene's root `userData`

This format is useful for:

- Sharing tilesets with adjacency data
- Version control of adjacency configurations
- Visual inspection of all tiles at once

## Importing GLB Adjacency Data

Use the `GLBAdjacencyLoader` helper to load adjacency data from exported GLB files:

```typescript
import { GLBAdjacencyLoader } from "./examples/adjacency-builder/GLBAdjacencyLoader";

const loader = new GLBAdjacencyLoader();

// Load from URL
const { configs, scene } = await loader.load("./adjacency-config.glb");

// Or merge with existing tileset
const updatedTileset = await loader.loadAndMerge(
  "./adjacency-config.glb",
  existingTileset
);
```

## Technical Details

### Symmetry Enforcement

When you set an adjacency relationship, the opposite is automatically applied:

```
Set: Tile A → north → Tile B
Automatically sets: Tile B → south → Tile A
```

This ensures consistency in your adjacency rules and reduces the number of pairs you need to review.

### Pair Generation

The builder generates all unique pairs efficiently:

- For N tiles, generates N\*(N+1)/2 pairs (including self-pairs)
- Tracks reviewed pairs using a Set for O(1) lookup
- In "continue mode", only generates pairs with new tiles

### New Tile Detection

A tile is considered "new" if:

1. It doesn't appear in any other tile's adjacency lists, AND
2. Its own adjacency object is empty

This allows you to add tiles to an existing tileset without re-reviewing all pairs.

## Best Practices

1. **Start with Core Tiles**: Begin with the most common tiles in your tileset
2. **Use Auto-advance**: Enable auto-advance for faster workflow once you're comfortable
3. **Review Regularly**: Check the review panel to ensure relationships make sense
4. **Export Often**: Save your progress by exporting JSON periodically
5. **Test in WFC**: Import your adjacency rules and test generation to validate

## Keyboard Shortcuts

Currently, the tool uses mouse/click interactions. Keyboard shortcuts may be added in a future version.

## Troubleshooting

### Models not loading

- Check that GLB file paths are correct
- Ensure models are in the `public` directory for Vite to serve them
- Check browser console for loading errors

### Export not working

- Ensure all tiles have loaded successfully
- Check browser console for export errors
- For GLB export, ensure tiles have 3D geometry

### Adjacencies not symmetric

- This should be automatic. If you find cases where it's not working, it's a bug
- Check the review panel to verify both directions are set

## Architecture

The adjacency builder consists of several key components:

### AdjacencyBuilder.ts

Core class managing tile data, pair generation, and adjacency relationships.

### GLBAdjacencyLoader.ts

Helper class for importing adjacency data from exported GLB files.

### demo.ts

Main application file handling UI, 3D rendering, and user interactions.

### adjacency-builder.html

Standalone HTML page with embedded CSS for the UI.

## Future Enhancements

Potential improvements for future versions:

- Visual indicators showing tiles in actual relative positions for each direction
- Undo/redo functionality
- Keyboard shortcuts for faster navigation
- Batch operations (set multiple directions at once)
- Import adjacency from JSON files
- Preview WFC generation with current adjacencies
- Adjacency rule templates (e.g., "ground tiles", "air tiles")
