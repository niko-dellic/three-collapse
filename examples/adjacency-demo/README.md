# Adjacency Demo - GLB UserData Workflow

This example demonstrates the complete workflow for using GLB files with embedded adjacency data.

## Overview

The workflow is:

1. **Build Adjacencies** → Use the Adjacency Builder tool to define tile relationships
2. **Export to GLB** → Save adjacency data into GLB `userData`
3. **Load for Generation** → This demo reads the GLB files and uses them for WFC

## Quick Start

### First Time Setup

1. **Create Adjacencies**:

   - Open [Adjacency Builder](http://localhost:5173/adjacency-builder.html)
   - Click "📁 Pick Directory"
   - Navigate to `public/models/blocks`
   - Grant read/write permissions

2. **Review Tiles**:

   - All tiles load automatically
   - No existing adjacencies (all blue)
   - Start reviewing pairs

3. **Save Adjacencies**:

   - Complete your adjacency definitions
   - Files automatically overwrite with new userData
   - Ready to use immediately!

4. **View in Demo**:
   - Open [Adjacency Demo](http://localhost:5173/adjacency-demo.html)
   - Tiles load with embedded adjacency data
   - Click "Generate" to create a world

### Continuing from Existing Data

1. **Pick Same Directory**:

   - Click "📁 Pick Directory"
   - Select `public/models/blocks` again

2. **Auto-Load**:

   - Tool reads adjacency data from each GLB
   - Green buttons show completed pairs
   - Blue buttons show pairs needing review

3. **Continue Work**:
   - Only review incomplete pairs
   - Or edit existing adjacencies

## How It Works

### GLB userData Structure

Each GLB file stores adjacency data in the first child's `userData`:

```javascript
{
  "adjacency": {
    "up": ["roof", "ceiling-corner"],
    "down": ["block", "base"],
    "north": ["block", "corner"],
    "south": ["block", "corner"],
    "east": ["block", "corner"],
    "west": ["block", "corner"]
  },
  "weight": 1
}
```

### Loading Pipeline

```typescript
// The tool automatically:
const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });

// Reads files
const files = await loadFromDirectory(dirHandle);

// Extracts adjacency data
const userData = gltf.scene.children[0].userData;

// Creates ModelTile3DConfig[]
const tiles = applyToModels(adjacencyData);

// Uses for WFC generation
const generator = new WFCGenerator(tiles);
```

## Benefits

### ✨ Single Source of Truth

- Adjacency data lives with the model
- No separate JSON to maintain
- Model + rules in one file

### 🔄 Easy Updates

- Modify adjacencies in the builder
- Save to same GLB files
- Demo updates automatically

### 📦 Portable

- Share GLB files with embedded rules
- Others can use immediately
- No configuration needed

### 🚀 Fast Workflow

- No manual JSON editing
- Visual verification
- Real-time preview

## File Structure

```
examples/adjacency-demo/
├── demo.ts              # Main demo entry point
└── README.md            # This file

public/models/blocks/
├── block.glb            # GLB with userData
├── corner.glb           # GLB with userData
├── roof.glb             # GLB with userData
└── ...                  # More tiles
```

## Browser Compatibility

| Feature          | Chrome/Edge | Firefox | Safari | Mobile |
| ---------------- | ----------- | ------- | ------ | ------ |
| Directory Picker | ✅ Full     | ❌      | ❌     | ❌     |
| File Upload      | ✅          | ✅      | ✅     | ⚠️     |
| Overwrite Files  | ✅          | ❌      | ❌     | ❌     |
| Download Files   | ✅          | ✅      | ✅     | ✅     |

**Recommendation**: Use Chrome or Edge for the full experience.

## API Usage

### Load from Directory (Recommended)

```typescript
import { loadTilesFromGLBFolder } from "./examples/adjacency-demo/demo";

// Load tiles with embedded adjacency data
const tiles = await loadTilesFromGLBFolder("/public/models/blocks");

// Use with WFC
const generator = new WFCGenerator(tiles);
```

### Load Specific Files

```typescript
import { GLBAdjacencyLoader } from "three-collapse";

// Load a single GLB file
const data = await GLBAdjacencyLoader.loadFromFile(file);

// Apply to models
const tiles = GLBAdjacencyLoader.applyToModels(data, "/models/blocks");
```

## Troubleshooting

### Directory picker doesn't appear

- You're not using Chrome/Edge
- Use file upload instead

### Files don't overwrite

- Need write permission to folder
- Re-select directory and grant write access
- Or use download fallback

### Adjacencies don't load

- GLB files might not have userData
- This is normal for first-time use
- Build adjacencies and save to embed data

### Exports too many files

- Browser download limits (usually 10)
- Use directory picker to bypass limits

## Next Steps

1. **Try the Builder**: Create adjacencies for your tiles
2. **Experiment**: Adjust rules and see results
3. **Integrate**: Use this workflow in your project
4. **Share**: Export GLB files with embedded rules

## Related Tools

- [Adjacency Builder](../adjacency-builder/) - Define tile relationships
- [GLBAdjacencyLoader](../../src/loaders/GLBAdjacencyLoader.ts) - Load utility
- [Template Demo](../template.ts) - Standard workflow

## Learn More

- [Adjacency Builder Docs](../../docs/ADJACENCY_BUILDER_API.md)
- [GLB Loader API](../../docs/LIBRARY_USAGE.md)
- [WFC Generator Usage](../../docs/WFCGENERATOR_USAGE.md)
