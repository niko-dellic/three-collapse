# Connector-Based Adjacency Builder

An advanced tool for automatically generating WFC adjacency rules using a connector-based system, inspired by [Marian42's WFC implementation](https://marian42.de/article/wfc/).

## Overview

Instead of manually reviewing every tile pair (O(N²) comparisons), this tool uses a connector-based approach where:

- Each tile face has a **connector group ID**
- Connectors with matching IDs can potentially connect
- **Symmetry/rotation rules** ensure proper geometric alignment
- Adjacencies are automatically generated from connector data

## Quick Start

1. Navigate to `/connector-builder.html`
2. Click "Pick Directory" (recommended) or "Upload GLB Files"
3. Tiles will be auto-arranged in a grid
4. Select tiles and edit their connectors
5. Click "Auto-Generate Adjacencies"
6. Export GLB files with embedded connector and adjacency data

## Connector System

### Face Connectors

Each tile has 6 connectors (one per face):

- **up** (vertical)
- **down** (vertical)
- **north** (horizontal)
- **south** (horizontal)
- **east** (horizontal)
- **west** (horizontal)

### Connector Properties

#### Group ID

- String identifier for the connector type
- Default: `"0"`, `"1"`, `"2"`, etc.
- Example: `"wall_side"`, `"floor_top"`, `"air"`

#### Vertical Faces (up/down)

**Rotation Index:**

- `0`, `1`, `2`, `3` - Specific 90° rotation angles
- `"invariant"` - Matches any rotation

#### Horizontal Faces (north/south/east/west)

**Symmetry:**

- `"flipped"` - Flipped orientation
- `"not-flipped"` - Standard orientation
- `"symmetric"` - Matches any orientation

### Connection Rules

Two connectors can connect if:

1. **Group IDs match**: `connectorA.groupId === connectorB.groupId`
2. **Symmetry/rotation compatible**:
   - **Vertical**: Either is `"invariant"` OR rotation indices match
   - **Horizontal**: Either is `"symmetric"` OR one is `"flipped"` and other is `"not-flipped"`
3. **No exclusion rule** blocks the connection

## Features

### Grid Layout & Selection

- **Auto-arrange**: Tiles arranged in XZ grid on load
- **Box selection**: Hold Shift + Drag to select multiple tiles (2D screen-space)
- **Multi-select**: Hold Shift + Click individual tiles
- **Transform mode**: Press `G` to move tiles (like Blender)

### Connector Editor

1. Select one or more tiles
2. Click "Edit Connectors"
3. Choose face (up/down/north/south/east/west)
4. Set group ID (or create new group)
5. Set rotation (vertical) or symmetry (horizontal)
6. Apply to all selected tiles

### Group Visibility

- Each group has a visibility checkbox in the groups list
- Hidden tiles cannot be selected or interacted with
- Useful for focusing on specific connector groups
- Visibility is independent per face direction
- Hidden tiles are automatically deselected if currently selected

### Exclusion Rules

Sometimes connectors match but the result doesn't look good. Use exclusions to block specific pairings:

1. Check "Enable Exclusion Mode"
2. Click source tile (turns red)
3. Select direction (↑↓→←↗↙)
4. Click target tile
5. Exclusion created: "source cannot be [direction] of target"

**Example**: Block a tunnel piece from being north of a wall, even if connectors match.

### Camera Controls

- **Left-click + Drag**: Rotate camera (orbit)
- **Right-click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out
- **Selection preserved**: Camera controls don't affect selection

### Auto-Generate Adjacencies

Once connectors are configured:

1. Click "✨ Auto-Generate Adjacencies"
2. Algorithm checks all tile pairs in all directions
3. Applies connector matching rules
4. Respects exclusion rules
5. Populates adjacency data automatically

### Export

**Export JSON** (Reference):

- Human-readable JSON with connectors, exclusions, and computed adjacencies
- Useful for debugging and review

**Save GLB Files**:

- Embeds connector data in `userData.connectors`
- Embeds exclusion rules in `userData.exclusions`
- Embeds computed adjacencies in `userData.adjacency`
- Saves to original directory (if picked) or downloads individually

## Keyboard Shortcuts

| Key             | Action                     |
| --------------- | -------------------------- |
| `1`             | Top view (camera)          |
| `2`             | Front view (camera)        |
| `3`             | Right side view (camera)   |
| `4`             | Left side view (camera)    |
| `G`             | Toggle transform/move mode |
| `ESC`           | Deselect all / Close modal |
| `Shift + Click` | Multi-select tiles         |
| `Shift + Drag`  | Box select tiles           |

## Workflow Example

### Simple Floor/Wall Tileset

1. **Load tiles**: `floor.glb`, `wall.glb`

2. **Configure floor**:

   - Up: `group_id="air"`, rotation=`invariant`
   - Down: `group_id="solid"`, rotation=`invariant`
   - North/South/East/West: `group_id="floor_side"`, symmetry=`symmetric`

3. **Configure wall**:

   - Up: `group_id="wall_top"`, rotation=`invariant`
   - Down: `group_id="solid"`, rotation=`invariant`
   - North/South/East/West: `group_id="wall_side"`, symmetry=`symmetric`

4. **Auto-generate**: Floor and wall connect vertically (shared `"solid"` connector)

5. **Export**: Both tiles now have correct adjacencies

## Connector Naming Best Practices

- **Descriptive names**: `"wall_side"` > `"0"`
- **Semantic groups**: `"air"`, `"solid"`, `"water"`
- **Material-based**: `"brick"`, `"wood"`, `"glass"`
- **Feature-based**: `"door_frame"`, `"window_edge"`

## Advantages Over Manual Builder

| Manual Builder                 | Connector Builder                   |
| ------------------------------ | ----------------------------------- |
| O(N²) pair comparisons         | O(N) connector assignments          |
| 30,300 decisions for 100 tiles | 600 connector settings (6 per tile) |
| No reusability                 | Connectors reused across tiles      |
| Hard to maintain consistency   | Geometric rules ensure consistency  |
| No spatial awareness           | Visual grid layout                  |

## Technical Details

### Data Structure

```typescript
interface ConnectorData {
  groupId: string;
  symmetry?: "flipped" | "not-flipped" | "symmetric"; // horizontal
  rotation?: 0 | 1 | 2 | 3 | "invariant"; // vertical
}

interface ConnectorTile {
  id: string;
  connectors: {
    up: ConnectorData;
    down: ConnectorData;
    north: ConnectorData;
    south: ConnectorData;
    east: ConnectorData;
    west: ConnectorData;
  };
  exclusions: Array<{
    targetTileId: string;
    direction: "up" | "down" | "north" | "south" | "east" | "west";
  }>;
  adjacency: {
    up: Set<string>;
    down: Set<string>;
    // ... computed from connectors
  };
}
```

### GLB userData Format

```json
{
  "tileId": "floor_01",
  "weight": 1,
  "connectors": {
    "up": { "groupId": "air", "rotation": "invariant" },
    "down": { "groupId": "solid", "rotation": "invariant" },
    "north": { "groupId": "floor_side", "symmetry": "symmetric" },
    "south": { "groupId": "floor_side", "symmetry": "symmetric" },
    "east": { "groupId": "floor_side", "symmetry": "symmetric" },
    "west": { "groupId": "floor_side", "symmetry": "symmetric" }
  },
  "exclusions": [],
  "adjacency": {
    "up": ["wall_01", "wall_02"],
    "down": ["foundation_01"]
  }
}
```

## Compatibility

- Works with GLB files from Blender, Unity, or any 3D tool
- Preserves existing connector data (re-edit anytime)
- Compatible with Three.js WFC implementation
- Exports work with original AdjacencyBuilderUI for verification

## Troubleshooting

**Q: Tiles not connecting?**

- Check group IDs match exactly (case-sensitive)
- Verify rotation/symmetry settings
- Look for exclusion rules blocking connection

**Q: Too many connections?**

- Use more specific group IDs
- Add exclusion rules for unwanted pairs
- Check if symmetry should be more restrictive

**Q: Transform controls not appearing?**

- Press `G` to enable transform mode
- Only works with single tile selected
- ESC to exit mode

**Q: Can't save to directory?**

- Use "Upload Files" mode (will download individually)
- Browser may need File System Access API permission
- Check browser console for errors

## References

- [Marian42's WFC Blog](https://marian42.de/article/wfc/) - Original connector system inspiration
- [Wave Function Collapse Algorithm](https://github.com/mxgmn/WaveFunctionCollapse)
- [Three.js TransformControls](https://threejs.org/docs/#examples/en/controls/TransformControls)
