# Adjacency Builder - Quick Start Guide

## Access the Tool

```bash
npm run dev
```

Then navigate to: **http://localhost:5173/adjacency-builder.html**

## 60-Second Tutorial

### 1. Choose Input Mode (3 options)

**Option A: Auto-discover** (Recommended for blocks folder)

- Automatically loads all GLB files from `/public/models/blocks/`
- Click "Start"

**Option B: Upload**

- Select "Upload GLB files" from dropdown
- Click file input to select multiple `.glb` files
- Click "Start"

**Option C: Continue from Existing**

- Select "Continue from existing"
- Loads `blockTileset` with existing adjacencies
- Click "Start"

### 2. Review Each Pair

You'll see two tiles side-by-side:

- **Blue tile (A)** on the left
- **Red tile (B)** on the right

Use your mouse to orbit around and inspect them.

### 3. Check Directions

For each direction, ask: **"Can Tile B be [direction] of Tile A?"**

Example:

- ✅ Check "Up" if Tile B can stack on top of Tile A
- ✅ Check "North" if Tile B can be placed north (+Z) of Tile A
- ❌ Leave unchecked if they don't fit together

**The opposite direction is automatically set!**

- If you check "North" (B north of A)
- The tool automatically sets "South" (A south of B)

### 4. Set Weight

Enter a weight for Tile B (default: 1)

- **Higher weight** = appears more often in generation
- **Lower weight** = appears less often (rare tiles)

Common weights:

- Air/empty tiles: 10-20
- Common tiles: 3-5
- Rare/special tiles: 1-2

### 5. Navigate

**Auto-advance** (recommended):

- Check "Auto-advance to next pair"
- Automatically moves to next pair after you check boxes

**Manual navigation**:

- Click "Next →" to go to next pair
- Click "← Previous" to go back
- Click "Skip Pair" to skip without changes
- Click numbered buttons to jump to specific pairs

**Visual indicators**:

- 🔵 Blue buttons = not reviewed
- 🟢 Green buttons = reviewed
- 🟡 Yellow border = current pair

### 6. Export Your Work

**JSON Export** (recommended):

```
Click "Download JSON"
```

Gives you a `ModelTile3DConfig[]` array ready to use in your code.

**GLB Export**:

```
Click "Download GLB"
```

Gives you a 3D scene with all adjacency data embedded.

## Using the Exported Data

### Quick Import (JSON)

1. Copy the downloaded JSON
2. In your tileset file:

```typescript
import adjacencyData from "./adjacency-config.json";

export const myTileset: ModelTile3DConfig[] = adjacencyData;
```

3. Use it with WFC:

```typescript
import { WFCGenerator } from "three-collapse";
import { myTileset } from "./my-tileset";

const generator = new WFCGenerator(myTileset);
const grid = await generator.generate(20, 10, 20);
```

## Tips

### 🎯 Best Practices

1. **Start small**: Begin with 3-5 tiles to learn the tool
2. **Test frequently**: Generate small grids to verify your rules work
3. **Save often**: Export JSON regularly to avoid losing work
4. **Use auto-advance**: Much faster once you're comfortable
5. **Check the review panel**: Verify your rules make sense

### 🚫 Common Mistakes

1. **Forgetting air tiles**: Air/empty tiles need HIGH weight (they're everywhere!)
2. **Too restrictive**: If no adjacencies set, tiles won't appear
3. **Not testing**: Always test your tileset with WFC generation
4. **Inconsistent scale**: Ensure your GLB models are the same scale

### 🔍 Troubleshooting

**Q: Models won't load**

- Check file paths are correct
- Ensure GLB files are valid
- Check browser console for errors

**Q: Too many pairs to review**

- Use "Continue mode" to only review new tiles
- Break tileset into smaller logical groups
- Some tiles might be similar enough to skip

**Q: WFC fails with my adjacencies**

- Some tile must be able to be placed initially
- Check that at least some tiles can connect
- Verify your adjacency rules aren't too restrictive

**Q: Tiles look wrong in 3D preview**

- This is just for visual reference
- The actual generation uses the adjacency rules, not positions
- Focus on whether the tiles conceptually fit together

## Advanced: Continue Mode

Perfect for adding new tiles to an existing tileset:

1. Select "Continue from existing"
2. The tool loads your current tileset
3. It identifies "new" tiles (no adjacencies, not referenced)
4. You only review pairs involving new tiles
5. Export updates your entire tileset

**New tile detection**: A tile is "new" if:

- It's not in any other tile's adjacency lists, AND
- It has no adjacency rules itself

## Examples

### Example 1: Simple Stacking

Tiles: `base`, `block`, `air`

```
base:
  ✅ up: block, air
  ✅ down: (nothing - base layer)
  ✅ all sides: base, air

block:
  ✅ up: block, air
  ✅ down: block, base
  ✅ all sides: block, air

air:
  ✅ up: air
  ✅ down: air, block, base
  ✅ all sides: air
```

### Example 2: Directional Pieces

Tiles: `corner`, `corner-inverted`

```
corner:
  ✅ east: corner-inverted (they mirror)
  ✅ west: corner-inverted
  ✅ up: air
  ✅ down: base

corner-inverted:
  (opposite directions auto-set)
```

## Next Steps

1. ✅ Build your first tileset (start with 3 tiles)
2. ✅ Export to JSON
3. ✅ Import into a WFC example
4. ✅ Generate and see results
5. ✅ Iterate: adjust weights and adjacencies based on results

## Resources

- **Full Documentation**: `docs/ADJACENCY_BUILDER.md`
- **Usage Examples**: `examples/adjacency-builder/usage-example.ts`
- **Implementation Notes**: `examples/adjacency-builder/IMPLEMENTATION_NOTES.md`

## Keyboard Reference

Currently mouse-only. Use:

- 🖱️ Click checkboxes to set adjacencies
- 🖱️ Click buttons to navigate
- 🖱️ Drag to orbit camera
- 🖱️ Scroll to zoom

---

**Happy adjacency building! 🎨**
