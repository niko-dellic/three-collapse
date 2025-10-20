# Connector Builder Implementation

Technical documentation for the connector-based adjacency builder system.

## Architecture Overview

The connector builder implements an automated adjacency detection system based on the connector approach described in [Marian42's WFC blog](https://marian42.de/article/wfc/).

### Key Components

1. **GLBFileUtils.ts** - Shared file loading/saving utilities
2. **ConnectorBuilderUI.ts** - Main connector builder implementation
3. **ConnectorBuilderUI.css** - UI styles
4. **connector-builder.html** - Entry point

## Core Concepts

### Connector-Based Adjacency

Traditional manual adjacency requires reviewing N×N tile pairs across 6 directions = O(N²×6) decisions.

Connector-based adjacency requires assigning connectors to N tiles × 6 faces = O(N×6) assignments.

**Example**: 100 tiles

- Manual: 5,050 pairs × 6 directions = **30,300 decisions**
- Connector: 100 tiles × 6 faces = **600 assignments**

### Connector Matching Algorithm

```typescript
function canConnect(tileA, tileB, direction):
  oppositeDirection = getOpposite(direction)
  connectorA = tileA.connectors[direction]
  connectorB = tileB.connectors[oppositeDirection]

  // Rule 1: Group IDs must match
  if connectorA.groupId !== connectorB.groupId:
    return false

  // Rule 2: Check compatibility
  if isVertical(direction):
    return checkRotationCompatibility(connectorA, connectorB)
  else:
    return checkSymmetryCompatibility(connectorA, connectorB)

function checkRotationCompatibility(connA, connB):
  if connA.rotation === "invariant" or connB.rotation === "invariant":
    return true
  return connA.rotation === connB.rotation

function checkSymmetryCompatibility(connA, connB):
  if connA.symmetry === "symmetric" or connB.symmetry === "symmetric":
    return true
  return (connA.symmetry === "flipped" and connB.symmetry === "not-flipped") or
         (connA.symmetry === "not-flipped" and connB.symmetry === "flipped")
```

## Data Structures

### ConnectorData

```typescript
interface ConnectorData {
  groupId: string; // Connector identifier
  symmetry?: "flipped" | "not-flipped" | "symmetric"; // Horizontal faces
  rotation?: 0 | 1 | 2 | 3 | "invariant"; // Vertical faces
}
```

**Design rationale**: Separate properties for horizontal/vertical faces matches real-world geometry constraints.

### TileConnectors

```typescript
interface TileConnectors {
  up: ConnectorData; // Vertical face
  down: ConnectorData; // Vertical face
  north: ConnectorData; // Horizontal face
  south: ConnectorData; // Horizontal face
  east: ConnectorData; // Horizontal face
  west: ConnectorData; // Horizontal face
}
```

### DirectionalExclusion

```typescript
interface DirectionalExclusion {
  targetTileId: string;
  direction: "up" | "down" | "north" | "south" | "east" | "west";
}
```

**Purpose**: Override connector matching for specific aesthetic/gameplay requirements.

## Features Implementation

### 1. Grid Layout System

```typescript
// Auto-arrange tiles in XZ plane
const cols = Math.ceil(Math.sqrt(tileCount));
const row = Math.floor(index / cols);
const col = index % cols;

position.set(col * gridSpacing, 0, row * gridSpacing);
```

**Grid spacing**: Default 3 units (configurable via `gridSpacing` config option).

### 2. Transform Controls Integration

Uses `THREE.TransformControls` for tile positioning:

- Attached to single selected tile
- Disabled orbit controls during dragging
- "G" hotkey toggles mode (Blender-like UX)
- Updates tile `gridPosition` on move

### 3. Drag Selection Box

**Implementation**: 2D screen-space selection with bounding box intersection (Shift + Drag)

1. On mousedown with Shift: Record start position and disable orbit controls
2. On mousemove: Draw CSS selection box overlay
3. On mouseup: Check bounding box intersection and re-enable orbit controls
4. If tile's screen-space bounding box intersects selection box → add to selection

```typescript
// Start selection only with Shift held
if (event.shiftKey && !intersectedTile) {
  isSelecting = true;
  orbitControls.enabled = false; // Disable orbiting during selection
}

// Robust bounding box intersection test
function isObjectInSelectionBox(object, selectionRect) {
  // 1. Get 3D bounding box of object
  const box = new THREE.Box3().setFromObject(object);

  // 2. Project all 8 corners to screen space
  const corners = [
    /* 8 corners of box */
  ];
  let minScreenX = Infinity,
    maxScreenX = -Infinity;
  let minScreenY = Infinity,
    maxScreenY = -Infinity;

  for (const corner of corners) {
    const projected = corner.clone().project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;
    minScreenX = Math.min(minScreenX, screenX);
    maxScreenX = Math.max(maxScreenX, screenX);
    minScreenY = Math.min(minScreenY, screenY);
    maxScreenY = Math.max(maxScreenY, screenY);
  }

  // 3. AABB intersection test
  return (
    selectionRect.left <= maxScreenX &&
    selectionRect.right >= minScreenX &&
    selectionRect.top <= maxScreenY &&
    selectionRect.bottom >= minScreenY
  );
}

// Re-enable controls
orbitControls.enabled = true;
```

**Advantages:**

- Accurate selection of objects with varying sizes
- Accounts for object rotation and perspective
- No false positives/negatives from center-point checking
- Works correctly with large or oddly-shaped objects

### 4. Connector Editor Modal

**Modal workflow**:

1. User selects tiles
2. Opens modal via "Edit Connectors" button
3. Selects face (up/down/north/south/east/west)
4. Sets group ID
5. Sets rotation (vertical) or symmetry (horizontal)
6. Applies to all selected tiles simultaneously

**UI responsiveness**: Modal fields change based on face type (vertical vs horizontal).

### 5. Exclusion System

**Three-step workflow**:

1. User enables exclusion mode
2. Clicks source tile (highlighted red)
3. Selects direction via button UI
4. Clicks target tile
5. Exclusion stored: `sourceTile.exclusions.push({ targetTileId, direction })`

**Application**: During auto-generation, exclusions are checked:

```typescript
if (hasExclusion(tileA, tileB.id, direction)) {
  continue; // Skip this adjacency
}
```

### 6. Auto-Generate Adjacencies

**Algorithm complexity**: O(N² × 6) checks, but with early exits

```typescript
for each tileA in tiles:
  for each tileB in tiles:
    for each direction in [up, down, north, south, east, west]:
      if canConnect(tileA, tileB, direction):
        if not hasExclusion(tileA, tileB.id, direction):
          tileA.adjacency[direction].add(tileB.id)
```

**Performance**: Fast enough for <1000 tiles (1000² × 6 = 6M checks, ~100ms on modern hardware).

### 7. Export System

**GLB Export**:

- Groups tiles by source file
- Clones each tile object
- Embeds connector data in `userData.connectors`
- Embeds exclusions in `userData.exclusions`
- Embeds computed adjacencies in `userData.adjacency`
- Exports as GLB via `GLTFExporter`

**Directory vs Download**:

- If directory handle exists → overwrite original files
- Otherwise → download individual GLB files

**JSON Export**:

- Reference format for debugging
- Includes all connector, exclusion, and adjacency data
- Human-readable with indentation

## Keyboard Shortcuts Implementation

```typescript
window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "Escape":
      clearSelection();
      closeModals();
      break;
    case "g":
    case "G":
      toggleTransformMode();
      break;
  }
});
```

## Visual Feedback

### Selection Highlighting

```typescript
// Selected tiles get yellow emissive glow
if (selected) {
  material.emissive = new THREE.Color(0xeab308);
  material.emissiveIntensity = 0.5;
}
```

### Exclusion Mode Highlighting

```typescript
// Source tile in exclusion mode gets red glow
material.emissive = new THREE.Color(0xff0000);
```

## File Format Specification

### GLB userData Structure

```json
{
  "tileId": "unique_tile_identifier",
  "weight": 1.0,
  "connectors": {
    "up": {
      "groupId": "connector_group_name",
      "rotation": "invariant"
    },
    "down": {
      "groupId": "connector_group_name",
      "rotation": 0
    },
    "north": {
      "groupId": "connector_group_name",
      "symmetry": "symmetric"
    },
    "south": {
      "groupId": "connector_group_name",
      "symmetry": "flipped"
    },
    "east": {
      "groupId": "connector_group_name",
      "symmetry": "not-flipped"
    },
    "west": {
      "groupId": "connector_group_name",
      "symmetry": "symmetric"
    }
  },
  "exclusions": [
    {
      "targetTileId": "tile_to_exclude",
      "direction": "north"
    }
  ],
  "adjacency": {
    "up": ["tile1", "tile2"],
    "down": ["tile3"],
    "north": [],
    "south": ["tile4", "tile5"],
    "east": ["tile6"],
    "west": []
  }
}
```

**Note**: Empty adjacency arrays mean tile is incompatible in that direction. To allow all connections, the adjacency object can be empty `{}` or omitted.

## Integration with WFC System

The connector builder outputs are directly compatible with the WFC generator:

```typescript
import { WFCGenerator } from "three-collapse";

// Load tiles with connector-generated adjacencies
const tiles = loadGLBWithUserData("tileset.glb");

const generator = new WFCGenerator({
  tiles: tiles.map((tile) => ({
    id: tile.userData.tileId,
    weight: tile.userData.weight,
    model: tile,
    adjacency: tile.userData.adjacency,
  })),
  dimensions: { width: 20, height: 10, depth: 20 },
});

await generator.generate();
```

## Performance Considerations

### Grid Layout

- O(N) positioning
- No performance concerns up to 10,000 tiles

### Selection Box

- O(N) screen projection per frame during drag
- Optimized with early visibility check
- Smooth up to 1,000 visible tiles

### Auto-Generate

- O(N² × 6) connector checks
- ~100ms for 1,000 tiles
- Could be optimized with spatial partitioning if needed

### Export

- O(N) tile cloning and userData embedding
- GLB export is linear in geometry complexity
- Directory writing is I/O bound

## Browser Compatibility

### File System Access API

- **Supported**: Chrome 86+, Edge 86+
- **Fallback**: File upload + download (all modern browsers)

### Required Features

- WebGL 2.0
- ES2020 modules
- CSS Grid/Flexbox
- File API

## Future Enhancements

### Potential Improvements

1. **Connector Visualization**

   - Show connector IDs on face normals
   - Color-code by group
   - Draw connection lines between compatible faces

2. **Batch Operations**

   - Select by connector group
   - Find all tiles with specific connector
   - Replace connector across multiple tiles

3. **Rotation Variants**

   - Auto-generate 90° rotations
   - Automatically rotate connectors
   - Deduplicate identical rotations

4. **Validation**

   - Warn about unreachable tiles
   - Check for disconnected connector groups
   - Suggest connector changes for better connectivity

5. **Import/Export**

   - Import connector definitions from JSON
   - Export connector templates
   - Share connector libraries

6. **Undo/Redo**
   - History stack for connector changes
   - Undo exclusions
   - Restore previous connector states

## Comparison with Manual Builder

| Feature         | Manual Builder        | Connector Builder          |
| --------------- | --------------------- | -------------------------- |
| Approach        | Pair-by-pair review   | Connector assignment       |
| Time Complexity | O(N²)                 | O(N)                       |
| UI              | Step-through wizard   | Spatial grid editor        |
| Selection       | Single pair at a time | Multi-select with drag box |
| Consistency     | Manual verification   | Geometric rules enforce    |
| Reusability     | None                  | Connector groups reusable  |
| Exclusions      | Not supported         | Directional exclusions     |
| Transform       | Static positioning    | TransformControls          |

## References

- [Marian42's WFC Blog Post](https://marian42.de/article/wfc/)
- [Wave Function Collapse GitHub](https://github.com/mxgmn/WaveFunctionCollapse)
- [Three.js TransformControls](https://threejs.org/docs/#examples/en/controls/TransformControls)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
