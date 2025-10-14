# Adjacency Builder - New Features

## Overview of Major Updates

The Adjacency Builder has been completely refactored with powerful new features for a streamlined workflow.

## 🚀 Key Features

### 1. File System Access API Integration

**Pick Directory (Recommended)**:

- Click "📁 Pick Directory" to select a folder containing GLB files
- Browser requests read/write permissions
- Automatically loads all GLB files from the directory
- **Exports save back to the same folder** (overwrites originals with adjacency data)

**Benefits**:

- ✅ One-click folder access
- ✅ Auto-saves to source folder
- ✅ No manual file management
- ✅ Preserves original filenames

**Browser Support**:

- ✅ Chrome/Edge (full support)
- ⚠️ Firefox/Safari (falls back to download)

### 2. Individual GLB Export

**Before**: Single GLB file with all tiles in a grid

**Now**: Each tile exported as its own GLB file

- `spiral-staircase.glb` with its adjacency data in `userData`
- `corner.glb` with its adjacency data in `userData`
- etc.

**Export Behavior**:

- **With directory access**: Overwrites original GLB files in the folder
- **Without directory access**: Downloads each file individually (with 100ms delay between files)

### 3. Auto-Population from Existing UserData

**GLB files can now store adjacency data**:

```javascript
// In your GLB file's userData:
{
  tileId: "spiral-staircase",
  weight: 1,
  adjacency: {
    up: ["air"],
    west: ["spiral-staircase-inverted"],
    // ...
  }
}
```

**When loading GLB files**:

- ✅ Automatically reads existing adjacency rules from `userData`
- ✅ Pre-populates the adjacency builder
- ✅ Marks pairs as "reviewed" if they have adjacencies
- ✅ Visual indicators show completed vs incomplete pairs

**Workflow**:

1. First time: Build adjacencies → Export GLB files
2. Later: Load same GLB files → Existing rules loaded → Review/edit/add new tiles
3. Export → GLB files updated with new adjacencies

### 4. Visual Completion Indicators

**Pair Navigation Buttons**:

- 🔵 **Blue**: Not reviewed yet (no adjacencies set)
- 🟢 **Green**: Complete (adjacencies defined)
- 🟡 **Yellow border**: Currently viewing

**Progress Tracking**:

- "Pair 5 / 36 (12 reviewed)"
- See at a glance how much work is left

### 5. JSON Export for Reference

**Still available** for debugging and reference:

- Click "Export JSON (Reference)"
- Gets a human-readable adjacency configuration
- Useful for:
  - Code generation
  - Debugging adjacency rules
  - Documentation
  - Sharing configurations

**Note**: JSON doesn't include 3D models, only adjacency data

## Complete Workflow

### Recommended Workflow (File System Access)

1. **Pick Directory**:

   ```
   Click "📁 Pick Directory"
   → Select your models folder
   → Browser asks for permission
   → Grant read/write access
   ```

2. **Auto-Load**:

   ```
   Tool automatically:
   - Finds all GLB files
   - Loads each file
   - Reads existing adjacency data from userData
   - Marks completed pairs
   ```

3. **Review/Edit**:

   ```
   - Green buttons = already complete
   - Blue buttons = need review
   - Click any pair to jump and edit
   - Add adjacencies for new pairs
   ```

4. **Save**:

   ```
   Click "Save GLB Files"
   → Each GLB file in the folder is overwritten
   → Adjacency data embedded in userData
   → Original geometry preserved
   ```

5. **Next Session**:
   ```
   Pick same directory
   → All your previous work loads automatically
   → Continue where you left off
   ```

### Fallback Workflow (File Upload)

1. **Upload Files**:

   ```
   Click "📄 Upload GLB Files"
   → Select multiple GLB files
   → Click "Start"
   ```

2. **Review**:

   ```
   Same as above
   ```

3. **Export**:
   ```
   Click "Save GLB Files"
   → Downloads each file individually
   → Files named: spiral-staircase.glb, corner.glb, etc.
   → Manually replace your original files
   ```

## Technical Details

### GLB UserData Structure

Each exported GLB file contains:

```javascript
// Root scene userData
{
  tileId: "spiral-staircase",
  weight: 1,
  adjacency: {
    up: ["air", "square-roof"],
    down: [],
    north: ["spiral-staircase"],
    south: ["spiral-staircase"],
    east: [],
    west: ["spiral-staircase-inverted"]
  }
}
```

### File System Access API Usage

```typescript
// Pick directory
const dirHandle = await window.showDirectoryPicker({
  mode: "readwrite",
});

// Iterate files
for await (const entry of dirHandle.values()) {
  if (entry.kind === "file" && entry.name.endsWith(".glb")) {
    const file = await entry.getFile();
    // Load and process
  }
}

// Save file (overwrite)
const fileHandle = dirHandle.getFileHandle("spiral-staircase.glb");
const writable = await fileHandle.createWritable();
await writable.write(arrayBuffer);
await writable.close();
```

### Browser Compatibility

| Feature           | Chrome/Edge  | Firefox     | Safari      |
| ----------------- | ------------ | ----------- | ----------- |
| Directory Picker  | ✅ Full      | ❌ No       | ❌ No       |
| File Upload       | ✅ Yes       | ✅ Yes      | ✅ Yes      |
| Individual Export | ✅ Overwrite | ⬇️ Download | ⬇️ Download |

## Benefits

### For Artists/Designers

- 🎨 Visual confirmation of tile relationships
- 💾 Work saved directly to project files
- 🔄 Iterative workflow - load, edit, save
- 📊 Clear progress indicators

### For Developers

- 🔧 Adjacency data embedded in model files
- 📦 Single source of truth (GLB contains geometry + rules)
- 🚀 No separate config files to manage
- 🔍 JSON export for debugging

### For Teams

- 🤝 Share GLB files with embedded adjacencies
- 📁 Version control friendly (one file per tile)
- 🔄 Easy to review changes (git diff on GLB userData)
- 📋 JSON export for documentation

## Migration from Old Version

If you have existing JSON configs:

1. **Option A**: Use JSON as reference, manually set adjacencies
2. **Option B**: Use the GLB export format going forward
3. **Option C**: Load JSON once, export as individual GLBs, switch to GLB workflow

## Best Practices

### 1. Use Directory Picker

Always use "Pick Directory" when possible:

- Fastest workflow
- Auto-saves to source
- No file management needed

### 2. Export JSON for Backup

After completing adjacencies:

- Export JSON as backup/documentation
- Commit JSON to version control for reference
- Use GLB files as working format

### 3. Incremental Building

For large tilesets:

- Work on a subset of tiles
- Export GLB files
- Add more tiles later
- Previous adjacencies load automatically

### 4. Test Integration

After building adjacencies:

```typescript
import { GLBTileLoader, WFCGenerator } from "three-collapse";

const loader = new GLBTileLoader();
// Loader will read adjacency data from GLB userData automatically
const modelData = await loader.loadTileset(yourGLBFiles);

const generator = new WFCGenerator(yourTileset);
const grid = await generator.generate(20, 10, 20);
```

## Future Enhancements

Potential improvements:

- Auto-save progress periodically
- Batch edit multiple pairs
- Adjacency templates/presets
- Visual diff of changes before saving
- Undo/redo for adjacency changes

## FAQ

**Q: Do I need to use File System Access?**
A: No, file upload works fine. Directory picker is just more convenient.

**Q: Can I mix both workflows?**
A: Yes! Use directory picker when available, file upload as fallback.

**Q: What happens if I close the browser mid-session?**
A: If using directory picker and you exported, your work is saved. Otherwise, you'll need to start over.

**Q: Can I use this with non-GLB models?**
A: Currently GLB only. Other formats may be added in future versions.

**Q: Does this work offline?**
A: Yes! All processing is local. No server required.

## Summary

The Adjacency Builder now provides a professional, file-system-integrated workflow:

1. 📁 **Pick directory** of GLB files
2. 🔍 **Auto-load** existing adjacency rules
3. ✏️ **Review/edit** with visual 3D preview
4. 💾 **Save** back to same files
5. 🔄 **Iterate** as needed

All with a beautiful shadcn-inspired UI! 🎨✨
