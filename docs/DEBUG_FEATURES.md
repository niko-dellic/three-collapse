# Debug Features

This document describes the debug and visualization tools available in three-collapse.

## DebugGrid

The `DebugGrid` class provides wireframe visualization of your WFC grid structure, making it easy to debug spatial issues, understand grid dimensions, and verify tile placement.

### Features

- **Wireframe Visualization**: Shows the boundaries of each grid cell
- **Bounding Box**: Highlights the outer edges of the entire grid
- **Toggle Visibility**: Can be shown/hidden on demand
- **Color Customization**: Adjust wireframe colors and opacity
- **Automatic Updates**: Updates when grid dimensions change

### Basic Usage

```typescript
import { DebugGrid } from "three-collapse";
import * as THREE from "three";

// Create a debug grid
const scene = new THREE.Scene();
const debugGrid = new DebugGrid(scene, cellSize);

// Update grid dimensions
debugGrid.updateGrid(width, height, depth);

// Toggle visibility
debugGrid.setVisible(true); // Show wireframe
debugGrid.setVisible(false); // Hide wireframe
debugGrid.toggle(); // Toggle current state

// Check visibility
const isVisible = debugGrid.isVisible();
```

### Advanced Options

#### Custom Colors

```typescript
// Change wireframe color and opacity
debugGrid.setWireframeColor(0x00ff00, 0.3); // Green at 30% opacity
debugGrid.setWireframeColor(0xff0000, 0.6); // Red at 60% opacity
```

#### Position Offset

```typescript
// Move the entire debug grid
debugGrid.setOffset(-5, 0, -5); // Center a 10x10x10 grid
```

#### Cleanup

```typescript
// Clean up when done
debugGrid.dispose(); // Removes from scene and frees resources
```

### Integration with Demos

The `DemoUI` utility includes built-in support for debug controls:

```typescript
import { createDemoUI, DebugGrid } from "three-collapse";

const debugGrid = new DebugGrid(scene, cellSize);

const ui = createDemoUI({
  // ... other config ...
  showDebugControls: true,
  debugWireframe: false, // Initial state
  onDebugWireframeChange: (enabled) => {
    debugGrid.setVisible(enabled);
  },
});
```

This adds a "Debug" section to your UI with a "Show wireframe grid" checkbox.

### Complete Example

```typescript
import * as THREE from "three";
import { WFCGenerator, DebugGrid, createDemoUI } from "three-collapse";

// Setup scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create debug grid
const cellSize = 1;
const debugGrid = new DebugGrid(scene, cellSize);

// Create generator
const generator = new WFCGenerator(tiles);

// Setup UI with debug controls
const ui = createDemoUI({
  title: "My WFC Demo",
  width: 10,
  height: 8,
  depth: 10,
  seed: Date.now(),
  onGenerate: async () => {
    const result = await generator.generate(width, height, depth);
    // Update debug grid to match generated dimensions
    debugGrid.updateGrid(width, height, depth);
  },
  // Enable debug controls
  showDebugControls: true,
  debugWireframe: false,
  onDebugWireframeChange: (enabled) => {
    debugGrid.setVisible(enabled);
  },
  // ... other config ...
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

### Visual Appearance

The debug grid consists of:

1. **Cell Wireframes** (Green, 30% opacity)
   - One wireframe box per grid cell
   - Shows individual cell boundaries
2. **Bounding Box** (Yellow, 60% opacity)
   - Outlines the entire grid
   - Thicker lines for better visibility

### Tips

- **Performance**: The debug grid can be expensive for very large grids (50x50x50+). Only enable it when needed.
- **Visibility**: The wireframe works best with solid models. For transparent materials, you may need to adjust opacity.
- **Color Contrast**: Choose wireframe colors that contrast with your scene's background and models.

### API Reference

#### Constructor

```typescript
constructor(scene: THREE.Scene, cellSize: number = 1)
```

#### Methods

- `updateGrid(width: number, height: number, depth: number): void`
  - Updates the grid to new dimensions
- `setVisible(visible: boolean): void`
  - Show or hide the wireframe
- `isVisible(): boolean`
  - Check current visibility state
- `toggle(): void`
  - Toggle visibility on/off
- `setWireframeColor(color: number, opacity: number = 0.3): void`
  - Customize wireframe appearance
- `setOffset(offsetX: number, offsetY: number, offsetZ: number): void`
  - Move the entire grid
- `clear(): void`
  - Remove all wireframe geometry
- `dispose(): void`
  - Clean up and remove from scene

## DemoUI Debug Controls

When `showDebugControls: true` is set in `createDemoUI()`, a "Debug" section appears with:

- **Show wireframe grid**: Checkbox to toggle the debug grid visualization

Additional debug controls may be added in future versions.

## See Also

- [Library Usage Guide](./LIBRARY_USAGE.md)
- [WFCGenerator Documentation](./WFCGENERATOR_USAGE.md)
- [DemoUI Reference](../src/utils/DemoUI.ts)
