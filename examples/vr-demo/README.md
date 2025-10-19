# VR WFC Demo

Interactive Wave Function Collapse generation in Virtual Reality using Three.js WebXR.

## Overview

This demo allows you to build and manipulate procedural structures using VR controllers. Use your right controller to create cells and your left controller to delete them, with full control over the size of each operation.

## Features

- **Interactive Cell Creation**: Point and trigger to expand WFC cells from any location
- **Cell Deletion**: Remove unwanted cells with the left controller
- **Configurable Sizes**: Adjust expansion/deletion dimensions independently for X, Y, and Z axes
- **Mode Switching**: Toggle between edit mode and teleportation mode
- **Real-time Generation**: See the WFC algorithm generate structures as you create them
- **Tileset Integration**: Uses the blocksez tileset with embedded adjacency rules

## Controls

### Edit Mode (Default)

- **Right Controller (Green Ray)**
  - Trigger: Create/expand cells at controller position
  - Preview: Green wireframe box showing expansion region
- **Left Controller (Red Ray)**

  - Trigger: Delete cells at controller position
  - Preview: Red wireframe box showing deletion region

- **Both Controllers**
  - Grip Button: Toggle between edit and locomotion modes

### Locomotion Mode

- **Right Controller (Blue Ray)**

  - Shows teleport arc
  - Trigger: Teleport to the marked location
  - Blue circle marker shows landing spot

- **Left Controller**
  - Disabled in locomotion mode

## Size Adjustment

In edit mode, you can adjust the expansion/deletion size:

### Keyboard Controls (Desktop Testing)

- Arrow Up/Down: Adjust Y size (height)
- Arrow Left/Right: Adjust X size (width)
- Page Up/Down: Adjust Z size (depth)
- E: Test expand at origin
- D: Test delete at origin
- M: Toggle mode

### VR Controller Controls

Size adjustment in VR should be implemented using thumbstick or trackpad input on your specific VR controllers.

## Technical Details

### Architecture

The VR demo consists of several key components:

1. **VRSceneSetup.ts**: Creates WebXR-enabled scene with proper lighting and ground plane
2. **VRControllerManager.ts**: Handles all controller input, mode switching, and visual feedback
3. **PreviewBox.ts**: Manages the colored wireframe boxes that preview operations
4. **demo.ts**: Main entry point that integrates everything with WFCGenerator

### Integration with WFC System

The demo uses the existing `WFCGenerator` class:

- `expandFromCell(x, y, z, sizeX, sizeY, sizeZ)`: Creates new cells
- `deleteFromCell(x, y, z, sizeX, sizeY, sizeZ)`: Removes cells
- Real-time rendering via `InstancedModelRenderer`

### Performance Considerations

- Async WFC generation doesn't block VR framerate
- Input is disabled during generation to prevent conflicts
- Targets 90fps for smooth VR experience
- Uses instanced rendering for efficient GPU utilization

## Getting Started

### Running the Demo

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Navigate to `/vr-demo.html` in your browser

3. Connect your VR headset (Meta Quest, Valve Index, etc.)

4. Click "Enter VR" button

5. Start creating structures!

### Testing Without VR Headset

The demo includes keyboard controls for testing on desktop:

- Use WASD + mouse to look around (standard Three.js controls)
- Press E to expand at origin
- Press D to delete at origin
- Use arrow keys to adjust sizes

### Supported VR Devices

Any WebXR-compatible VR headset should work, including:

- Meta Quest 2/3/Pro
- Valve Index
- HTC Vive
- Windows Mixed Reality headsets
- Any other WebXR-supported device

## Configuration

You can modify the configuration in `demo.ts`:

```typescript
const config = {
  cellSize: 2, // Size of each cell in world units
  width: 5, // Initial grid dimensions (not used in empty start)
  height: 3,
  depth: 5,
  workerCount: 4, // Number of Web Workers for WFC
  seed: Date.now(), // Random seed
  debug: false, // Debug UI (disable in VR)
};
```

## Tileset

The demo uses the `blocksez` tileset located in `/public/models/blocksez/`. Each GLB file contains:

- 3D model geometry
- Embedded adjacency rules in userData
- Material properties

## Troubleshooting

### "Enter VR" button doesn't appear

- Ensure your browser supports WebXR (Chrome, Edge, Firefox)
- Check that your VR headset is connected and detected
- Try using a different browser

### Controllers not working

- Make sure controllers are paired and turned on
- Check browser console for errors
- Verify WebXR session is active

### Performance issues

- Reduce `workerCount` in config
- Use smaller expansion sizes
- Simplify the tileset

### Generation failures

- The WFC algorithm may occasionally fail to find a solution
- The system automatically retries with a different seed
- Try different positions or smaller sizes if issues persist

## Future Enhancements

Possible improvements:

- Controller-based size adjustment UI with thumbsticks
- Visual text indicators showing current size
- Undo/redo functionality
- Save/load generated structures
- Multi-user collaboration
- Custom tileset selection in VR
- Performance optimizations for larger structures

## Development

To modify the VR demo:

1. **Add new controller features**: Edit `VRControllerManager.ts`
2. **Change visual feedback**: Modify `PreviewBox.ts`
3. **Adjust scene setup**: Update `VRSceneSetup.ts`
4. **Add new interactions**: Extend `demo.ts`

## License

MIT - See LICENSE file in repository root
