# Adjacency Builder API Documentation

## Overview

The `AdjacencyBuilderUI` is a complete, self-contained visual tool for building tile adjacency rules. It can be instantiated programmatically and integrated into any Three.js application.

## Installation

The adjacency builder is included in the main three-collapse package:

```typescript
import { AdjacencyBuilderUI } from "three-collapse";
```

## Quick Start

### Basic Usage

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

// Create the adjacency builder
const builder = new AdjacencyBuilderUI();
```

That's it! The builder will:

- Create its own 3D scene with camera and controls
- Generate a complete UI for building adjacencies
- Handle all user interactions
- Provide export functionality

### With Configuration

```typescript
import { AdjacencyBuilderUI } from "three-collapse";
import { myExistingTileset } from "./tileset";

const builder = new AdjacencyBuilderUI({
  container: document.body,
  existingTileset: myExistingTileset,
  onExportJSON: (json) => {
    console.log("Exported JSON:", json);
    // Custom handling (e.g., save to server, copy to clipboard)
  },
  onExportGLB: (blob) => {
    console.log("Exported GLB:", blob.size, "bytes");
    // Custom handling
  },
});
```

## Configuration Options

### `AdjacencyBuilderConfig`

```typescript
interface AdjacencyBuilderConfig {
  container?: HTMLElement;
  existingTileset?: ModelTile3DConfig[];
  onExportJSON?: (json: string) => void;
  onExportGLB?: (blob: Blob) => void;
}
```

#### `container`

- **Type**: `HTMLElement`
- **Optional**: Yes (defaults to `document.body`)
- **Description**: Container element for the 3D canvas

#### `existingTileset`

- **Type**: `ModelTile3DConfig[]`
- **Optional**: Yes
- **Description**: Existing tileset to use in "Continue from existing" mode

#### `onExportJSON`

- **Type**: `(json: string) => void`
- **Optional**: Yes
- **Description**: Custom handler for JSON export. If not provided, downloads file automatically.

#### `onExportGLB`

- **Type**: `(blob: Blob) => void`
- **Optional**: Yes
- **Description**: Custom handler for GLB export. If not provided, downloads file automatically.

## Methods

### `dispose()`

Clean up resources and remove UI elements.

```typescript
const builder = new AdjacencyBuilderUI();

// When done
builder.dispose();
```

## Features

### 1. Three Input Modes

**Auto-discover**:

- Automatically loads all GLB files from `/public/models/blocks/`
- Uses Vite's `import.meta.glob`
- Best for project-based tilesets

**Upload**:

- File input for uploading multiple GLB files
- Best for external assets

**Continue from existing**:

- Loads an existing `ModelTile3DConfig[]`
- Detects new tiles and only generates pairs for them
- Best for incremental tileset building

### 2. Direction-by-Direction Review

- Reviews one direction at a time for each tile pair
- Shows tiles in their actual spatial relationship
- Clear Yes/No buttons
- Automatic progression through all 6 directions

### 3. Self-Pair Optimization

When comparing a tile with itself:

- Only requires 3 questions (up/north/east)
- Automatically sets opposite directions (down/south/west)
- Saves 50% of the time for self-comparisons

### 4. Visual Features

- **3D Preview**: See tiles positioned in actual spatial relationships
- **Auto-center**: Toggle to center objects by bounding box
- **Labels**: Optional SpriteText labels with backgrounds
- **Color coding**: Blue for Tile A, Red for Tile B

### 5. Navigation

- **Yes/No/All**: Quick adjacency setting
- **Previous/Next**: Navigate through directions and pairs
- **Skip Pair**: Jump to next pair
- **Quick Navigation**: Click any pair name to jump directly

### 6. Weight Management

- Dedicated panel for setting tile weights
- Per-tile (not per-pair) configuration
- Real-time updates

### 7. Export Formats

- **JSON**: Standard `ModelTile3DConfig[]` array
- **GLB**: 3D scene with embedded adjacency data

### 8. Celebration

- Confetti animation when all pairs are complete! 🎉

## Examples

### Standalone Application

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

new AdjacencyBuilderUI();
```

### With Existing Tileset

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

const myTileset = [
  {
    id: "block",
    model: "./models/block.glb",
    weight: 2,
    adjacency: {
      up: ["air"],
      down: ["base"],
    },
  },
  // ... more tiles
];

new AdjacencyBuilderUI({
  existingTileset: myTileset,
});
```

### Custom Export Handling

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

new AdjacencyBuilderUI({
  onExportJSON: async (json) => {
    // Save to localStorage
    localStorage.setItem("adjacency-config", json);

    // Or send to server
    await fetch("/api/save-adjacency", {
      method: "POST",
      body: json,
      headers: { "Content-Type": "application/json" },
    });

    console.log("Saved to server!");
  },
  onExportGLB: async (blob) => {
    // Upload to server
    const formData = new FormData();
    formData.append("file", blob, "adjacency.glb");

    await fetch("/api/upload-glb", {
      method: "POST",
      body: formData,
    });

    console.log("Uploaded to server!");
  },
});
```

### Embedded in Custom Application

```typescript
import { AdjacencyBuilderUI } from "three-collapse";

class MyApp {
  private adjacencyBuilder: AdjacencyBuilderUI;

  constructor() {
    // Create custom container
    const container = document.createElement("div");
    container.id = "builder-container";
    document.body.appendChild(container);

    // Initialize builder
    this.adjacencyBuilder = new AdjacencyBuilderUI({
      container,
      onExportJSON: (json) => {
        this.handleAdjacencyExport(json);
      },
    });
  }

  private handleAdjacencyExport(json: string): void {
    // Parse and use the adjacency data
    const tileset = JSON.parse(json);

    // Use in your WFC generation
    this.generateWorld(tileset);
  }

  cleanup(): void {
    this.adjacencyBuilder.dispose();
  }
}
```

## Integration with WFC

After building adjacencies, use them directly in generation:

```typescript
import { AdjacencyBuilderUI, WFCGenerator } from "three-collapse";

// Step 1: Build adjacencies
const builder = new AdjacencyBuilderUI({
  onExportJSON: async (json) => {
    // Step 2: Parse the exported JSON
    const tileset = JSON.parse(json);

    // Step 3: Generate with WFC
    const generator = new WFCGenerator(tileset, {
      workerCount: 4,
      maxRetries: 3,
    });

    const grid = await generator.generate(20, 10, 20);

    console.log("Generated!", grid);
    generator.dispose();
  },
});
```

## Styling

The builder includes all necessary styles internally. No external CSS required!

Styles are automatically injected when the class is instantiated.

### Customizing Colors

To customize colors, you can override the injected styles:

```typescript
const builder = new AdjacencyBuilderUI();

// Add custom styles after initialization
const customStyles = document.createElement("style");
customStyles.textContent = `
  #adjacency-ui {
    background: rgba(20, 20, 50, 0.95) !important;
  }
  .pair-nav-btn {
    background: #ff6b6b !important;
  }
`;
document.head.appendChild(customStyles);
```

## Best Practices

1. **Dispose when done**: Call `builder.dispose()` to clean up resources

2. **Use existing tileset**: Pass your current tileset to continue mode for incremental building

3. **Custom export handlers**: Use `onExportJSON` and `onExportGLB` for integration with your app

4. **Progressive enhancement**: Start with a small tileset and add tiles incrementally

## Architecture

The `AdjacencyBuilderUI` class encapsulates:

- **Three.js Scene**: Complete 3D rendering setup
- **OrbitControls**: Camera manipulation
- **GLTFLoader**: Model loading
- **UI Generation**: All HTML elements created programmatically
- **Style Injection**: CSS injected automatically
- **Event Handling**: All user interactions managed internally
- **Export Logic**: JSON and GLB generation

## Complete Example Application

```typescript
import {
  AdjacencyBuilderUI,
  GLBTileLoader,
  WFCGenerator,
} from "three-collapse";

class TilesetBuilder {
  private builder: AdjacencyBuilderUI;
  private tileset: ModelTile3DConfig[] | null = null;

  constructor() {
    this.builder = new AdjacencyBuilderUI({
      onExportJSON: (json) => this.handleExport(json),
    });
  }

  private async handleExport(json: string): Promise<void> {
    this.tileset = JSON.parse(json);

    console.log("Tileset complete with", this.tileset.length, "tiles");

    // Optionally test generation
    await this.testGeneration();
  }

  private async testGeneration(): Promise<void> {
    if (!this.tileset) return;

    console.log("Testing WFC generation...");

    const generator = new WFCGenerator(this.tileset, {
      workerCount: 4,
      maxRetries: 3,
    });

    const grid = await generator.generate(10, 5, 10, {
      onProgress: (p) => console.log(`${(p * 100).toFixed(1)}%`),
    });

    if (grid) {
      console.log("✅ Generation successful!");
    } else {
      console.error("❌ Generation failed - check adjacency rules");
    }

    generator.dispose();
  }

  destroy(): void {
    this.builder.dispose();
  }
}

// Use it
const app = new TilesetBuilder();
```

## Troubleshooting

### UI doesn't appear

- Ensure the class is instantiated after DOM is ready
- Check console for errors
- Verify Three.js is properly installed

### Models don't load

- Check file paths are correct
- Ensure GLB files are accessible
- Look for CORS issues in console

### Export doesn't work

- Check if all tiles have loaded successfully
- Verify browser supports Blob downloads
- Check console for export errors

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  AdjacencyBuilderConfig,
  TilePair,
  AdjacencyData,
  TileData,
} from "three-collapse";
```

## Dependencies

Required peer dependencies:

- `three` (^0.160.0 or later)
- `js-confetti` (^0.13.0 or later)
- `three-spritetext` (^1.10.0 or later)

All automatically handled if using the package.

## License

MIT - Part of the three-collapse package.
