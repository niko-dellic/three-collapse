# Quick Start: Setting Up Test Models

If you want to quickly test the model-based WFC demo without finding/downloading models, here's how to create simple placeholder GLB files using Blender.

## Option 1: Download Free Models (Recommended)

### Using Kenney Assets

1. Go to https://kenney.nl/assets/modular-buildings
2. Download the pack (it's free!)
3. Find GLB files in the download
4. Copy them to this directory and rename as needed

### Using Quaternius Assets

1. Visit https://quaternius.com/
2. Browse "Ultimate Modular" packs
3. Download and extract
4. Copy GLB files to this directory

## Option 2: Create Simple Test Cubes in Blender

If you have Blender installed, you can quickly create test models:

### Creating a Block Model

1. Open Blender
2. Delete the default cube (X key)
3. Add a new cube (Shift+A > Mesh > Cube)
4. Scale to 0.9 (S, 0.9, Enter) - slightly smaller for gaps
5. Add material and color
6. File > Export > glTF 2.0 (.glb)
7. Settings:
   - Format: glTF Binary (.glb)
   - Check "Apply Modifiers"
   - Check "Export Materials"
8. Save as `block.glb`

### Creating a Base Model

1. Same as above, but scale it to (1, 0.5, 1) for a flatter piece
2. Save as `base.glb`

### Creating Empty Model (Optional)

1. Create a tiny cube (scale 0.01)
2. Make material transparent or same as background
3. Save as `empty.glb`

## Option 3: Use Online GLB Generators

1. Visit https://gltf.pmnd.rs/
2. Create simple shapes
3. Export as GLB
4. Download and place in this directory

## Testing Your Setup

Once you have at least `block.glb` and `base.glb`:

1. Run `npm run dev` from the project root
2. Navigate to http://localhost:5173/models.html
3. Click "Generate"
4. Your models should appear!

## Troubleshooting

### "Failed to load GLB file" error

- Check the browser console for the exact file path it's trying to load
- Verify your files are named correctly
- Make sure they're in `/public/models/` directory

### Models are huge/tiny

- Edit `examples/models/demo.ts` and change `cellSize` value
- Or rescale your models in Blender

### Models don't appear

- Check if you filtered out the tile type (like 'air')
- Verify the tileset configuration references the correct IDs
- Check browser console for errors

## Minimal Test Setup

At minimum, you need:

- `block.glb` - any simple 3D model
- `base.glb` - another simple 3D model (can be same as block)

The `empty.glb` is optional since air tiles are filtered out before rendering.
