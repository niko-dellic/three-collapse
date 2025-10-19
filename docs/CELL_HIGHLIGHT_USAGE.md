# Cell Highlight - Quick Start Guide

## How to Use Cell Highlighting

### Step 1: Enable Wireframe Grid

1. Open the debug UI (right side of screen)
2. Expand the **"Debug"** folder
3. Check **"Show Wireframe Grid"**
   - You should now see green wireframe boxes for each cell
   - Yellow outline shows the overall grid boundary

### Step 2: Open Local Expansion Controls

1. Expand the **"Local Expansion"** folder
2. You'll see six sliders:
   - **Cell X, Y, Z** - Select which cell to highlight/expand from
   - **Expansion X, Y, Z** - Set the size of expansion region

### Step 3: Select a Cell

1. Adjust the **Cell X, Y, Z** sliders
2. Watch the **orange highlighted box** move in real-time
3. The highlight shows exactly which cell you've selected

### Step 4: Validate Cell (Optional)

1. Click **"Validate Cell"** button
2. An alert will tell you if the cell is on the periphery
3. ✓ = Can expand from this cell (on edge)
4. ✗ = Cannot expand (surrounded by other cells)

### Step 5: Expand or Delete

- Click **"Expand From Cell"** to add new cells around the selected cell
- Click **"Delete From Cell"** to remove cells in that region

## Tips & Tricks

### Finding Valid Cells

**Valid expansion cells must be on the periphery** (at least one neighbor doesn't exist):

- Start with edge cells (X=0, X=max, Z=0, Z=max)
- Cells at Y=0 or Y=max are usually safe
- Corner cells are almost always valid
- Use "Validate Cell" button to check

### Understanding Slider Limits

- Sliders automatically adjust to grid size
- Range is `-2x grid size` to `+2x grid size`
- Minimum range: ±50 units
- Limits update when you change grid dimensions

### Visual Feedback

- **Orange highlight** = Your selected cell
- **Green wireframe** = All existing cells
- **Yellow outline** = Grid boundaries
- **No highlight visible?** → Make sure wireframe is enabled

### Common Workflows

#### Workflow 1: Expand from Corner

```
1. Generate initial grid (e.g., 10x5x10)
2. Enable wireframe
3. Set Cell X=0, Y=0, Z=0
4. Validate Cell (should be ✓)
5. Set Expansion X=5, Y=3, Z=5
6. Click "Expand From Cell"
```

#### Workflow 2: Expand from Edge

```
1. After generating, find edge cell
2. Set Cell X=9, Y=0, Z=5 (right edge)
3. Validate Cell
4. Adjust expansion size
5. Click "Expand From Cell"
```

#### Workflow 3: Delete Region

```
1. Select any cell in the grid
2. Set deletion size (Expansion sliders)
3. Click "Delete From Cell"
4. Region is removed, rendering updates
```

## Troubleshooting

### Highlight Not Visible

- ✓ Is wireframe enabled?
- ✓ Are coordinates within grid bounds?
- ✓ Is the highlight box behind other geometry?

### Can't Expand from Cell

**Error: "Cell is not on periphery"**

- Cell is surrounded by other cells
- Try edge cells (X=0, X=max, Z=0, Z=max)
- Try corner cells
- Use "Validate Cell" to find valid cells

### Sliders Not Working

**Values reset or won't change:**

- Grid dimensions may have changed
- Sliders auto-update limits
- Try adjusting Grid Dimensions first

### Expansion Overlap Error

**Error: "Expansion region overlaps with existing cell"**

- Expansion region would cover existing cells
- Reduce expansion size
- Move to different cell
- Check with wireframe which cells exist

## Keyboard Shortcuts

Currently no keyboard shortcuts, but you can:

- Use mouse wheel on sliders for fine control
- Click and drag slider handles
- Click slider track to jump to position
- Type numbers directly in input fields (if available in lil-gui)

## Best Practices

### Before Expanding

1. ✓ Enable wireframe first
2. ✓ Validate the cell
3. ✓ Check expansion size won't overlap
4. ✓ Verify highlight position visually

### During Expansion

- Start with small expansions (3-5 cells)
- Test on corner/edge cells first
- Save before large operations
- Check console for error messages

### After Expansion

- Check rendering updated correctly
- Verify new cells are where expected
- Grid dimensions may have grown
- Slider limits automatically update

## Advanced Usage

### Programmatic Control

```typescript
// In code, you can control highlighting:
const debugGrid = generator.getDebugGrid();
if (debugGrid) {
  // Highlight specific cell
  debugGrid.highlightCell(5, 0, 5);

  // Hide highlight
  debugGrid.hideHighlight();

  // Check if cell is valid
  const isValid = generator.isCellOnPeriphery(5, 0, 5);
}
```

### Custom Highlight Color

Currently not exposed in UI, but you can modify in code:

```typescript
// In DebugGrid.ts, change highlight color:
color: 0xff6600,  // Orange (default)
color: 0x00ffff,  // Cyan
color: 0xff00ff,  // Magenta
```

## Next Steps

After mastering cell highlighting:

- Explore auto-expand mode (Grid Dimensions folder)
- Try different expansion sizes
- Experiment with non-contiguous grids
- Build complex structures by chaining expansions

## Need Help?

Check these docs:

- `SPARSE_GRID_IMPLEMENTATION.md` - Technical details
- `CELL_HIGHLIGHT_FEATURE.md` - Feature documentation
- `WFCGENERATOR_USAGE.md` - Generator API guide

Or check the console for detailed error messages!
