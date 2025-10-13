# Grid Shrinking Feature

## Overview

The demo now supports dynamically shrinking the grid when slider values are reduced, allowing tiles to be removed without requiring a full regeneration.

## How It Works

### Detection Logic

The `onGridSizeChange()` method in `demo.ts` now detects three scenarios:

1. **Pure Shrinking**: When all changed dimensions decrease

   - Example: Width 10→8, Height 8→6, Depth 10→10
   - Action: Calls `shrink()` to remove tiles

2. **Pure Expansion**: When all changed dimensions increase

   - Example: Width 10→12, Height 8→10, Depth 10→10
   - Action: Calls `generate(true)` to expand with WFC

3. **Mixed Change**: When some dimensions increase and others decrease
   - Example: Width 10→8, Height 8→10, Depth 10→10
   - Action: Calls `shrinkThenExpand()` which:
     1. First shrinks to remove tiles from decreased dimensions
     2. Then expands to add tiles to increased dimensions

### Shrink Implementation

The `shrinkGrid()` function in `generate.ts`:

1. **Validates** that there's an existing grid to shrink
2. **Creates a new grid** with the smaller dimensions
3. **Copies tiles** from the old grid that fit within the new bounds
4. **Updates the buffer** with the new cell data
5. **Updates the renderer** to display the shrunk grid
6. **Maintains expansion state** so further changes can still use incremental updates

### Key Features

- **Instant**: No WFC algorithm needed - tiles are simply removed
- **Preserves existing tiles**: Only removes tiles outside the new bounds
- **Maintains state**: The shrunk grid can still be expanded later
- **Visual feedback**: Shows progress bar with "Shrinking grid..." message
- **Smart centering**: Updates the renderer offset to keep the grid centered

## Usage

With "Auto-expand mode" enabled:

1. Generate an initial grid (e.g., 10×8×10)
2. Drag any slider to a **lower** value
3. The grid automatically shrinks after 500ms delay
4. Tiles outside the new bounds are removed
5. You can then expand again by increasing the slider

## Example Scenarios

### Scenario 1: Reduce Width

- Before: 10×8×10 grid
- Action: Move width slider from 10 to 8
- Result: Last 2 columns (x=8 and x=9) are removed instantly

### Scenario 2: Reduce Height

- Before: 10×8×10 grid
- Action: Move height slider from 8 to 5
- Result: Top 3 layers (y=5, y=6, y=7) are removed instantly

### Scenario 3: Reduce Multiple Dimensions

- Before: 10×8×10 grid
- Action: Width 10→8, Depth 10→8
- Result: Grid shrinks to 8×8×8, removing outer edges

### Scenario 4: Mixed Changes

- Before: 10×8×10 grid
- Action: Width 10→8, Height 8→10
- Result:
  1. Shrinks width to 8
  2. Expands height from 8 to 10 using WFC

## Technical Details

### Grid Storage

- Grid is stored as `string[][][]` where indices are `[x][y][z]`
- Shrinking uses nested loops to copy only tiles within new bounds
- No reallocation needed - just creates a smaller array

### Buffer Update

- Both the grid and the buffer are updated
- Buffer maintains cell state for potential future expansion
- Cell data includes position, collapsed state, and tile ID

### Renderer Integration

- Calls `modelRenderer.updateGrid()` with the filtered grid
- Updates offset to maintain centering: `(-size * cellSize) / 2`
- Filters out "air" tiles before rendering

## Benefits

1. **Performance**: Shrinking is instant (no algorithm computation)
2. **User Experience**: Smooth grid resizing in both directions
3. **Flexibility**: Can grow and shrink the grid multiple times
4. **Consistency**: Works seamlessly with the existing expansion feature

## Future Enhancements

Potential improvements:

- Animation when tiles are removed
- Option to "fade out" removed tiles
- Undo/redo support for size changes
- Preset size configurations
