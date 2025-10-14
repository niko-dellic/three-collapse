# Updated Features - Adjacency Builder

## What Changed

The adjacency builder has been updated with several improvements based on user feedback:

### 1. Direction-by-Direction Review ✨

**Before**: All 6 directions shown as checkboxes at once
**Now**: Each direction is reviewed one at a time with Yes/No buttons

**How it works**:

- For each tile pair, you review 6 directions sequentially
- The 3D view updates to show tiles in their actual spatial relationship for each direction
- Progress indicator shows "Direction: Up (1/6)" through "Direction: West (6/6)"
- Question clearly states: "Can '[Tile B]' be [DIRECTION] from '[Tile A]'?"

**Benefits**:

- Clearer spatial understanding - see tiles positioned exactly as they would be
- Less overwhelming - focus on one relationship at a time
- Easier to make accurate decisions

### 2. Tile Names in Navigation 📝

**Before**: Navigation buttons showed only numbers (1, 2, 3...)
**Now**: Navigation buttons show actual tile names (e.g., "corner ↔ door")

**Benefits**:

- Immediately see which tiles you're reviewing
- Easy to find and jump to specific tile pairs
- Better overview of your progress

### 3. Per-Tile Weight Management ⚖️

**Before**: Weight input shown per-pair in the review section
**Now**: Separate "Manage Tile Weights" panel for all tiles

**How to use**:

1. Click "Manage Tile Weights" button
2. Panel expands showing all tiles with weight inputs
3. Adjust weights for any tile
4. Click button again to hide panel

**Benefits**:

- Weights are logically per-tile, not per-pair
- See all tile weights at once
- No confusion about which tile's weight is being set

### 4. Auto-Advance Removed 🚫

**Before**: Optional auto-advance checkbox
**Now**: Clicking Yes/No automatically advances to next direction

**Benefits**:

- Simpler workflow - no toggle to manage
- Faster for most users
- Can still use Next/Previous buttons for manual control

## Updated Workflow

1. **Start**: Choose input mode and click "Start"

2. **Review Directions**: For each pair, answer 6 yes/no questions

   - Question: "Can '[Tile B]' be [UP/DOWN/NORTH/SOUTH/EAST/WEST] from '[Tile A]'?"
   - Click ✓ Yes or ✗ No
   - Tool automatically moves to next direction
   - 3D view updates to show new spatial relationship

3. **Navigate**:

   - **Next** → : Advance to next direction (or next pair if at last direction)
   - **← Previous**: Go back to previous direction (or previous pair if at first direction)
   - **Skip Pair**: Skip remaining directions and go to next pair
   - **Tile Pairs**: Click any pair name to jump directly to it

4. **Manage Weights**: Click "Manage Tile Weights" to adjust weights for all tiles

5. **Export**: Download JSON or GLB when complete

## Navigation Details

### Within a Pair

Each pair has 6 directions to review:

1. Up
2. Down
3. North
4. South
5. East
6. West

**Auto-advance on Yes/No**:

- Click Yes or No → automatically advances to next direction
- At direction 6 → automatically moves to next pair

**Manual navigation**:

- Click "Next →" → skip current question, move to next direction
- Click "← Previous" → go back to previous direction

### Between Pairs

**Skip Pair button**:

- Skips all remaining directions for current pair
- Moves to first direction of next pair

**Quick Navigation**:

- Click any tile pair button (e.g., "spiral-staircase ↔ air")
- Jumps to that pair's first direction
- Useful for reviewing specific combinations

## Spatial Positioning

The 3D view now shows tiles in their actual relative positions:

- **Up**: Tile B positioned 2 units above Tile A
- **Down**: Tile B positioned 2 units below Tile A
- **North**: Tile B positioned 2 units north (+Z) of Tile A
- **South**: Tile B positioned 2 units south (-Z) of Tile A
- **East**: Tile B positioned 2 units east (+X) of Tile A
- **West**: Tile B positioned 2 units west (-X) of Tile A

Use orbit controls to view from any angle and verify the relationship makes sense.

## Tips for the New Workflow

1. **Trust the positioning**: The 3D view accurately shows the spatial relationship

2. **Use orbit controls**: Rotate around to see tiles from all angles before deciding

3. **Think about the question**: "Can B be [direction] of A?" not "Should B be..."

   - Answer "Yes" if it's physically/aesthetically possible
   - Answer "No" if it doesn't make sense

4. **Use Skip Pair sparingly**: Better to answer all questions for consistency

5. **Jump to specific pairs**: Use the tile name buttons when you need to review a specific combination

6. **Set weights first**: Click "Manage Tile Weights" before starting to set all weights upfront

## Migration from Old Version

If you were using the previous version:

- **Checkboxes → Yes/No buttons**: Same functionality, just one direction at a time
- **Auto-advance → Automatic**: Always advances after answering
- **Weight per pair → Weight panel**: Weights moved to dedicated section
- **Number navigation → Name navigation**: Easier to find specific pairs

The core functionality and exports remain the same - all your previous work is compatible!
