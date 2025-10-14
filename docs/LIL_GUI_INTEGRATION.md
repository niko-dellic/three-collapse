# lil-gui Integration

The three-collapse demos now use [lil-gui](https://lil-gui.georgealways.com/) for a professional, lightweight GUI system. This provides a much cleaner, more maintainable interface compared to custom HTML controls.

## Overview

lil-gui is a lightweight JavaScript GUI library that provides:

- Automatic controller generation based on data types
- Collapsible folders for organization
- Sliders, dropdowns, color pickers, and more
- Clean, modern styling
- Small bundle size (~8kb gzipped)

## Basic Usage

```typescript
import { createDemoUI } from "three-collapse";

const ui = createDemoUI({
  title: "My WFC Demo",
  width: 10,
  height: 8,
  depth: 10,
  seed: Date.now(),
  onGenerate: () => generate(),
  onRandomSeed: () => {
    // Handle random seed
  },
  onSeedChange: (seed) => {
    // Handle seed change
  },
  onWidthChange: (width) => {
    // Handle width change
  },
  onHeightChange: (height) => {
    // Handle height change
  },
  onDepthChange: (depth) => {
    // Handle depth change
  },
  widthRange: { min: 5, max: 30 },
  heightRange: { min: 1, max: 20 },
  depthRange: { min: 5, max: 30 },
});
```

## UI Configuration

### Required Options

- `width`, `height`, `depth`: Initial grid dimensions
- `seed`: Initial random seed
- `onGenerate`: Callback for generation button
- `onRandomSeed`: Callback for random seed button
- `onSeedChange`, `onWidthChange`, `onHeightChange`, `onDepthChange`: Callbacks for value changes

### Optional Options

- `title`: GUI panel title (default: "WFC Demo")
- `widthRange`, `heightRange`, `depthRange`: Min/max ranges for sliders
- `showExpansionToggle`: Show auto-expand toggle
- `expansionMode`: Initial expansion mode state
- `onExpansionChange`: Callback for expansion toggle
- `showWorkerControls`: Show worker configuration
- `useWorkers`: Initial worker state
- `workerCount`: Initial worker count
- `onUseWorkersChange`: Callback for worker toggle
- `onWorkerCountChange`: Callback for worker count change
- `showDebugControls`: Show debug options
- `debugWireframe`: Initial wireframe state
- `onDebugWireframeChange`: Callback for wireframe toggle

## Progress Bar

The GUI includes a custom progress bar since lil-gui doesn't have built-in progress indicators:

```typescript
import {
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
} from "three-collapse";

// Show progress with message
showProgress(ui, "Generating...");

// Update progress (0-100)
setProgress(ui, 50);

// Change color
setProgressColor(ui, "#ef4444"); // Red for errors

// Hide progress
hideProgress(ui);
```

## Tileset Editor Integration

The tileset editor automatically integrates with lil-gui:

```typescript
import { createTilesetEditor } from "three-collapse";

const tilesetEditor = createTilesetEditor({
  tiles: myTiles,
  parentGUI: ui.gui, // Pass the GUI instance
  onTransformChange: (tileId, transform) => {
    // Handle transform changes
    modelRenderer.updateTileTransform(tileId, {
      position: new THREE.Vector3(
        transform.position.x,
        transform.position.y,
        transform.position.z
      ),
      rotation: new THREE.Euler(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z
      ),
      scale: new THREE.Vector3(
        transform.scale.x,
        transform.scale.y,
        transform.scale.z
      ),
    });
  },
});

// The editor is automatically added to the parent GUI
```

## Complete Example

```typescript
import * as THREE from "three";
import {
  WFCGenerator,
  InstancedModelRenderer,
  GLBTileLoader,
  createDemoUI,
  createTilesetEditor,
  showProgress,
  hideProgress,
  setProgress,
} from "three-collapse";

class MyDemo {
  private ui: DemoUIElements;
  private generator: WFCGenerator;
  private renderer: InstancedModelRenderer;

  constructor() {
    // Create UI
    this.ui = createDemoUI({
      title: "My WFC Demo",
      width: 10,
      height: 8,
      depth: 10,
      seed: Date.now(),
      onGenerate: () => this.generate(),
      onRandomSeed: () => {
        this.seed = Date.now();
      },
      onSeedChange: (seed) => {
        this.seed = seed;
      },
      onWidthChange: (width) => {
        this.width = width;
      },
      onHeightChange: (height) => {
        this.height = height;
      },
      onDepthChange: (depth) => {
        this.depth = depth;
      },
      showWorkerControls: true,
      showDebugControls: true,
    });

    // Create tileset editor
    const tilesetEditor = createTilesetEditor({
      tiles: this.tiles,
      parentGUI: this.ui.gui,
      onTransformChange: (tileId, transform) => {
        this.renderer.updateTileTransform(tileId, {
          position: new THREE.Vector3(
            transform.position.x,
            transform.position.y,
            transform.position.z
          ),
          rotation: new THREE.Euler(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
          ),
          scale: new THREE.Vector3(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z
          ),
        });
      },
    });
  }

  private async generate() {
    showProgress(this.ui, "Generating...");
    setProgress(this.ui, 0);

    try {
      const result = await this.generator.generate(
        this.width,
        this.height,
        this.depth,
        {
          onProgress: (progress) => {
            setProgress(this.ui, progress * 100);
          },
          onTileUpdate: (x, y, z, tileId) => {
            // Real-time rendering
          },
        }
      );

      showProgress(this.ui, "Complete!");
      setProgress(this.ui, 100);

      setTimeout(() => {
        hideProgress(this.ui);
      }, 1500);
    } catch (error) {
      showProgress(this.ui, `Failed: ${error.message}`);
      setProgressColor(this.ui, "#ef4444");

      setTimeout(() => {
        hideProgress(this.ui);
        setProgressColor(this.ui, "var(--focus-color)");
      }, 3000);
    }
  }
}
```

## Styling

lil-gui uses CSS variables for theming. You can customize colors by overriding these variables:

```css
:root {
  --background-color: #1f1f1f;
  --text-color: #ebebeb;
  --title-background-color: #111111;
  --title-text-color: #ebebeb;
  --widget-color: #424242;
  --hover-color: #4f4f4f;
  --focus-color: #595959;
  --number-color: #2cc9ff;
  --string-color: #a2db3c;
}
```

## Migration from Custom UI

If you're migrating from the old custom UI system:

### Before

```typescript
const ui = createDemoUI({ ... });
ui.generateBtn.disabled = true;
ui.progressContainer.classList.add("visible");
ui.progressFill.style.width = "50%";
```

### After

```typescript
const ui = createDemoUI({ ... });
// Button states are managed by the library
showProgress(ui, "Generating...");
setProgress(ui, 50);
```

### Key Changes

1. **No Direct DOM Access**: You no longer access UI elements directly
2. **Simplified Progress API**: Use helper functions instead of DOM manipulation
3. **Automatic Button States**: Generate button is automatically managed
4. **Integrated Folders**: Everything is organized in collapsible folders
5. **Cleaner Code**: Less boilerplate, more maintainability

## API Reference

### createDemoUI(config)

Creates a lil-gui-based demo interface.

**Returns**: `DemoUIElements`

- `gui`: The lil-gui GUI instance
- `gridFolder`: The grid dimensions folder
- `progressElement`: The custom progress bar element

### showProgress(ui, message?)

Shows the progress bar with an optional message.

### hideProgress(ui)

Hides the progress bar.

### setProgress(ui, percent)

Sets the progress bar to a percentage (0-100).

### setProgressColor(ui, color)

Changes the progress bar color (CSS color string).

## See Also

- [lil-gui Documentation](https://lil-gui.georgealways.com/)
- [Tileset Editor](./TILESET_EDITOR.md)
- [Debug Features](./DEBUG_FEATURES.md)
- [Library Usage Guide](./LIBRARY_USAGE.md)
