# Cell Highlight Feature

## Overview

Added visual cell highlighting and dynamic slider limits to the Local Expansion UI controls, making it easier to select and visualize cells for expansion/deletion operations.

## New Features

### 1. Cell Highlight Visualization

When the wireframe grid is enabled, a highlighted cell indicator is displayed at the currently selected coordinates.

#### DebugGrid Updates

**File:** `src/utils/DebugGrid.ts`

New methods added:

```typescript
// Highlight a specific cell at grid coordinates
highlightCell(x: number, y: number, z: number): void

// Hide the cell highlight
hideHighlight(): void
```

**Visual Appearance:**

- Orange semi-transparent box (0.95x cell size)
- Orange wireframe edges for better visibility
- Only visible when wireframe grid is enabled
- Automatically updates when cell size changes
- Properly cleaned up on disposal

**Implementation Details:**

- Uses `THREE.Mesh` with semi-transparent material (opacity: 0.3)
- Includes `THREE.LineSegments` for edge highlighting
- Position updates in real-time as user adjusts coordinates
- Visibility is tied to wireframe grid visibility state

### 2. Dynamic Slider Limits

The Local Expansion controls now dynamically adjust their slider limits based on the current grid dimensions.

#### Initial Setup

When the Local Expansion UI is created:

- Cell X slider: `-maxX` to `maxX` where `maxX = max(50, width * 2)`
- Cell Y slider: `-maxY` to `maxY` where `maxY = max(50, height * 2)`
- Cell Z slider: `-maxZ` to `maxZ` where `maxZ = max(50, depth * 2)`

This ensures sliders always cover the current grid extent plus some buffer for expansion.

#### Dynamic Updates

When grid dimensions change (via Grid Dimensions controls):

- Slider limits automatically update to match new dimensions
- Minimum limit: 50 units (for reasonable expansion range)
- Maximum limit: 2x current dimension (allows expansion beyond current grid)
- Updates happen immediately when dimension sliders change

### 3. Real-Time Highlight Updates

The cell highlight updates in real-time as you adjust the cell coordinates:

```typescript
// Each coordinate slider has an onChange handler
cellXController.onChange(() => updateHighlight());
cellYController.onChange(() => updateHighlight());
cellZController.onChange(() => updateHighlight());
```

**User Experience:**

1. Enable "Show Wireframe Grid" in Debug controls
2. Open "Local Expansion" folder
3. Adjust Cell X/Y/Z sliders
4. See highlighted cell move in 3D viewport
5. Visually verify cell position before expansion/deletion

## Usage Example

```typescript
// Enable wireframe to see highlights
generator.setDebugGridVisible(true);

// Get debug grid reference
const debugGrid = generator.getDebugGrid();

// Highlight a specific cell
if (debugGrid) {
  debugGrid.highlightCell(5, 0, 5);
}

// Hide highlight
debugGrid.hideHighlight();
```

## Integration with Existing Features

### Works With:

- ✅ Wireframe grid toggle (Debug → Show Wireframe Grid)
- ✅ Cell size adjustments (automatically updates highlight size)
- ✅ Grid dimension changes (automatically updates slider limits)
- ✅ Auto-expand/shrink mode
- ✅ All local expansion operations (validate, expand, delete)

### Behavior:

- Highlight only visible when wireframe is enabled
- Highlight persists across grid dimension changes
- Highlight updates immediately on coordinate change
- Sliders prevent invalid coordinates outside reasonable bounds

## Technical Implementation

### Memory Management

- Highlight mesh created once on initialization
- Properly disposed when DebugGrid is disposed
- Edge geometry and materials cleaned up
- No memory leaks on repeated grid updates

### Performance

- Single mesh for highlight (no per-frame creation)
- Position updates are cheap (just setting transform)
- No impact on WFC generation performance
- Minimal overhead (~1 mesh + edges)

### Coordinate System

- Uses same coordinate system as WFC grid
- Position = coordinate \* cellSize
- Centered at cell origin (not cell center)
- Consistent with existing debug grid visualization

## Visual Design

### Colors

- Highlight: Orange (#ff6600)
- Opacity: 30% (0.3)
- Edge lines: Solid orange (#ff6600)

### Sizing

- Highlight box: 95% of cell size (0.95x)
- Slight gap prevents z-fighting with grid edges
- Edge lines: linewidth 3 (more prominent)

### Visibility States

| Wireframe | Highlight Set | Visible |
| --------- | ------------- | ------- |
| Off       | No            | No      |
| Off       | Yes           | No      |
| On        | No            | No      |
| On        | Yes           | Yes     |

## Future Enhancements

Possible improvements:

1. **Color coding** - Different colors for valid/invalid cells
2. **Expansion preview** - Show ghost boxes for expansion region
3. **Click to select** - Pick cell by clicking in 3D viewport
4. **Keyboard controls** - Arrow keys to move highlighted cell
5. **Cell info tooltip** - Show tile ID and metadata on hover
6. **Multiple highlights** - Show expansion region boundaries
7. **Animated transitions** - Smooth movement between cells

## Related Files

- `src/utils/DebugGrid.ts` - Core highlight implementation
- `src/utils/debugUI.ts` - UI integration and slider management
- `src/generators/WFCGenerator.ts` - Grid dimension tracking
- `docs/SPARSE_GRID_IMPLEMENTATION.md` - Overall sparse grid system

## Summary

The cell highlight feature significantly improves the user experience for local expansion operations by:

- Providing immediate visual feedback of selected cells
- Preventing invalid coordinate selections through dynamic slider limits
- Seamlessly integrating with existing debug visualization tools
- Maintaining performance and proper resource management

Users can now confidently select cells for expansion/deletion operations with clear visual confirmation of their selections.
