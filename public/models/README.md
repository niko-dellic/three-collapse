# 3D Model Assets

This directory contains GLB model files used by the model-based Wave Function Collapse demo.

## Required Models

To use the model demo, you need to provide the following GLB files:

### Simple Tileset (examples/tiles/models/tileset.ts - simpleModelTileset)

- `block.glb` - A basic cube or block piece
- `base.glb` - A foundation or base piece
- `empty.glb` - (Optional) Placeholder for air tiles

### Full Tileset (examples/tiles/models/tileset.ts - modelTileset)

- `floor.glb` - Floor tile
- `wall.glb` - Wall piece
- `corner.glb` - Corner connector
- `foundation.glb` - Bottom support piece
- `roof.glb` - Roof/ceiling tile
- `empty.glb` - (Optional) Placeholder for air tiles

## Where to Find Free 3D Models

### Recommended Sources

1. **Kenney Assets** (https://kenney.nl/assets)

   - High-quality, public domain game assets
   - Look for "Modular Building Kit" or "City Kit"
   - Free for commercial use

2. **Quaternius** (https://quaternius.com/)

   - Low-poly 3D models
   - CC0 license (public domain)
   - Great for prototyping

3. **Poly Pizza** (https://poly.pizza/)

   - Community-sourced low-poly models
   - Various licenses (check individual models)
   - Good variety of styles

4. **Sketchfab** (https://sketchfab.com/)
   - Search for models with "Download" option
   - Filter by "Free" and check licenses
   - Many CC-BY licensed models available

## Model Requirements

### Technical Specifications

- **Format**: GLB (binary glTF)
- **Size**: Ideally centered at origin (0,0,0)
- **Scale**: Models should be approximately 1 unit in size
- **Faces**: Keep polygon count reasonable (<5000 triangles per model)
- **Materials**: Embedded in GLB file

### Design Considerations

For Wave Function Collapse to work well:

- Models should be modular and fit together seamlessly
- Consider adjacency rules when designing/selecting pieces
- Ensure consistent scale across all models
- Models should align on a grid

## Converting Models to GLB

If you have models in other formats (OBJ, FBX, etc.), you can convert them to GLB:

### Using Blender (Free)

1. Import your model (File > Import)
2. Export as GLB (File > Export > glTF 2.0)
3. Choose "Binary (.glb)" format
4. Enable "Apply Modifiers" and "Export Materials"

### Online Converters

- https://products.aspose.app/3d/conversion
- https://anyconv.com/gltf-to-glb-converter/

## Example Models Setup

Here's a quick start guide using Kenney assets:

1. Visit https://kenney.nl/assets/modular-buildings
2. Download the pack
3. Extract and find the GLB files
4. Copy/rename the following to this directory:

   - A basic tile → `block.glb`
   - A foundation piece → `base.glb`
   - Any decorative piece → `empty.glb` (or create a small invisible cube)

5. Adjust the tileset configuration in `examples/tiles/models/tileset.ts` if needed

## Testing Your Models

1. Place your GLB files in this directory
2. Update the tileset configuration if using different model names
3. Run the dev server: `npm run dev`
4. Navigate to `/models.html` in your browser
5. Click "Generate" to test the Wave Function Collapse with your models

## Troubleshooting

### Models not loading

- Check browser console for errors
- Verify file paths match the tileset configuration
- Ensure GLB files are valid (test in a viewer like https://gltf-viewer.donmccurdy.com/)

### Models appear too large/small

- Adjust the `cellSize` parameter in `examples/models/demo.ts`
- Or scale your models in Blender before exporting

### Models have wrong orientation

- Rotate models in Blender to face forward (-Z direction)
- Apply rotation (Ctrl+A > Rotation) before exporting

### Performance issues

- Reduce polygon count of models
- Use simpler materials/textures
- Reduce grid size in the demo

## License

Please ensure you have the right to use any models you place in this directory and respect the licenses of the original creators.
