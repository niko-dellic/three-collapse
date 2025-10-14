# Adjacency Builder Implementation Notes

## What Was Built

A complete visual tool for building tile adjacency rules with the following features:

### Core Features Implemented ✅

1. **Three Input Modes**

   - Auto-discover: Loads all GLB files from `/public/models/blocks/`
   - Upload: Accepts multiple GLB file uploads
   - Continue: Loads existing `ModelTile3DConfig[]` to add new tiles

2. **3D Visualization**

   - Side-by-side tile preview with Three.js
   - Orbit controls for camera manipulation
   - Color-coded tiles (blue for Tile A, red for Tile B)
   - Text labels for tile identification

3. **Adjacency Definition**

   - Checkboxes for 6 directions (up, down, north, south, east, west)
   - Automatic symmetry enforcement
   - Real-time adjacency updates

4. **Navigation**

   - Previous/Next buttons
   - Auto-advance toggle
   - Quick navigation with numbered pair buttons
   - Visual indicators for reviewed pairs

5. **Weight Management**

   - Input field for setting tile weights
   - Weights stored and exported with adjacency data

6. **Review Panel**

   - Shows all tiles with current adjacency rules
   - Updates in real-time as you make changes

7. **Export Formats**

   - JSON: Standard `ModelTile3DConfig[]` format
   - GLB: 3D scene with grid layout and embedded adjacency data

8. **Import Helper**
   - `GLBAdjacencyLoader` class for loading exported GLB files
   - Merge capability with existing tilesets

## Files Created

```
/Users/nikodellic/Documents/GitHub/three-collapse/
├── adjacency-builder.html                          # Main HTML page
├── vite.config.ts                                  # Updated with new entry point
├── docs/
│   └── ADJACENCY_BUILDER.md                       # Complete documentation
├── examples/
│   └── adjacency-builder/
│       ├── demo.ts                                # Main application
│       ├── AdjacencyBuilder.ts                    # Core adjacency logic
│       ├── GLBAdjacencyLoader.ts                  # Import helper
│       ├── usage-example.ts                       # Usage examples
│       └── IMPLEMENTATION_NOTES.md               # This file
└── README.md                                      # Updated with tool info
```

## Technical Implementation

### AdjacencyBuilder Class

**Responsibilities:**

- Tile pair generation and tracking
- Adjacency relationship management
- Symmetry enforcement
- New tile detection
- Export to JSON and GLB

**Key Methods:**

- `initializeFromPaths()`: Start fresh with file paths
- `initializeFromExisting()`: Continue from existing tileset
- `setAdjacency()`: Set relationships with automatic symmetry
- `getAdjacency()`: Retrieve current relationships
- `exportToJSON()`: Export as ModelTile3DConfig[]
- `exportToGLB()`: Export as GLB with embedded data

### Symmetry Enforcement

When setting adjacency from Tile A to Tile B in direction D:

```typescript
// User checks: A → north → B
tileAData.adjacency.north.add(B);

// Automatically set: B → south → A
tileBData.adjacency.south.add(A);
```

This ensures consistency and reduces the number of pairs to review.

### New Tile Detection

A tile is "new" if both conditions are true:

1. Not referenced in any other tile's adjacency lists
2. Has no adjacency rules of its own (all directions empty)

This allows incremental tileset building without re-reviewing existing pairs.

### Pair Tracking

Uses a Set with canonical keys to track reviewed pairs:

```typescript
const key = tileA <= tileB ? `${tileA}|${tileB}` : `${tileB}|${tileA}`;
reviewedPairs.add(key);
```

This ensures pairs are only reviewed once, regardless of order.

## Usage Flow

1. **Start**: Choose input mode and click "Start"
2. **Review**: For each pair, check applicable directions
3. **Weight**: Set weight for Tile B
4. **Navigate**: Use Next/Previous or jump to specific pairs
5. **Review**: Check the review panel for completeness
6. **Export**: Download JSON or GLB with adjacency data

## Export Formats

### JSON Format

```json
[
  {
    "id": "tile-name",
    "weight": 1,
    "model": "/path/to/model.glb",
    "adjacency": {
      "up": ["other-tile"],
      "down": ["base-tile"],
      "north": ["tile-name", "air"],
      "south": ["tile-name", "air"],
      "east": ["tile-name", "air"],
      "west": ["tile-name", "air"]
    }
  }
]
```

### GLB Format

- Grid layout: tiles arranged in sqrt(N) × sqrt(N) grid
- Tile userData: Contains tile ID and weight
- Scene userData: Contains complete adjacency configuration
- Spacing: 2 units between tiles

## Known Limitations & Future Enhancements

### Current Limitations

1. Tiles are shown side-by-side, not in actual relative positions for each direction
2. No undo/redo functionality
3. No keyboard shortcuts
4. No batch operations
5. Can't import JSON files (only GLB)

### Potential Enhancements

1. **Direction Preview**: Show tiles positioned based on currently checked direction
2. **Keyboard Shortcuts**: Arrow keys for navigation, space for advance, etc.
3. **Undo/Redo**: Stack-based history management
4. **Batch Operations**: Set multiple tiles at once (e.g., "all ground tiles")
5. **JSON Import**: Load adjacency from JSON files
6. **Templates**: Pre-defined adjacency patterns
7. **Validation**: Real-time WFC constraint checking
8. **Preview Generation**: Test current adjacencies with small WFC generation
9. **Search/Filter**: Find specific tiles or pairs
10. **Comments/Notes**: Add notes to tile pairs for documentation

## Testing Recommendations

1. **Test with small tilesets first** (3-5 tiles)
2. **Verify symmetry** by checking the review panel
3. **Test JSON export** by importing into an existing example
4. **Test GLB export** by loading with GLBAdjacencyLoader
5. **Generate with WFC** to ensure rules produce valid results
6. **Check edge cases**:
   - Single tile
   - Two tiles
   - All tiles can be adjacent to all tiles
   - Tiles with no adjacencies

## Performance Considerations

- **Pair count**: O(N²) pairs for N tiles
- **Memory**: Stores all tile objects in memory
- **Loading**: Async loading of all GLB files at start
- **Export**: GLB export creates full scene (may be slow for many tiles)

For large tilesets (>50 tiles), consider:

- Breaking into logical groups
- Using the "continue" mode to work incrementally
- Regular exports to save progress

## Integration with WFC

The exported adjacency data is directly compatible with:

- `WFCGenerator`
- `WFC3D`
- `WFCTile3D`

Simply use the exported JSON as your tileset configuration:

```typescript
import adjacencyConfig from "./adjacency-config.json";
import { WFCGenerator } from "three-collapse";

const generator = new WFCGenerator(adjacencyConfig);
const grid = await generator.generate(20, 10, 20);
```

## Conclusion

The Adjacency Builder provides a complete solution for visually defining tile adjacencies. It handles the complexity of symmetric relationships, tracks progress, and exports in multiple formats. The tool significantly reduces the manual work and potential errors in building WFC tilesets.
