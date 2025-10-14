/**
 * Example: How to use exported adjacency data from the Adjacency Builder
 */

import type { ModelTile3DConfig } from "../../src/wfc3d";
import { GLBAdjacencyLoader } from "../../src/loaders";

// ============================================
// Method 1: Import JSON directly
// ============================================

// After exporting from the Adjacency Builder, you get a JSON file
// You can import it directly:

import adjacencyConfig from "./files/adjacency-config.json"; // Example path

export const tilesetFromJSON: ModelTile3DConfig[] = adjacencyConfig;

// ============================================
// Method 2: Load from GLB file (Basic)
// ============================================

async function loadFromGLB() {
  const loader = new GLBAdjacencyLoader();

  // Load adjacency data from exported GLB
  const { configs, scene } = await loader.load("./adjacency-config.glb");

  // The configs array contains ModelTile3DConfig objects
  // but the model paths are placeholders
  // You'll need to map them to actual model paths

  const tileset: ModelTile3DConfig[] = configs.map((config) => ({
    ...config,
    // Map the tile ID back to the actual model path
    model: `/models/blocks/${config.id}.glb`,
  }));

  return tileset;
}

// ============================================
// Method 2b: Load from GLB with applyToModels helper
// ============================================

async function loadFromGLBWithModels() {
  const loader = new GLBAdjacencyLoader();

  // Define model path mapping
  const modelPathMap = {
    "spiral-staircase": "./models/blocks/spiral-staircase.glb",
    "spiral-staircase-inverted": "./models/blocks/spiral-staircase.glb",
    "square-roof": "./models/blocks/square-roof.glb",
    "corner-inverted": "./models/blocks/corner-inverted.glb",
    "handrail-entrance": "./models/blocks/handrail-entrance.glb",
  };

  // Load adjacency data and apply model paths
  const tileset = await loader.applyToModels(
    "./adjacency-config.glb",
    modelPathMap
  );

  return tileset;
}

// ============================================
// Method 2c: Load from GLB with pre-loaded models (RECOMMENDED)
// ============================================

async function loadFromGLBWithPreloadedModels() {
  const { GLBTileLoader, GLBAdjacencyLoader } = await import(
    "../../src/loaders"
  );

  // Step 1: Define model path mapping
  const modelPathMap = {
    "spiral-staircase": "./models/blocks/spiral-staircase.glb",
    "spiral-staircase-inverted": "./models/blocks/spiral-staircase.glb",
    "square-roof": "./models/blocks/square-roof.glb",
    "corner-inverted": "./models/blocks/corner-inverted.glb",
    "handrail-entrance": "./models/blocks/handrail-entrance.glb",
  };

  // Step 2: Create a minimal tileset for loading models
  const minimalTileset: ModelTile3DConfig[] = Object.entries(modelPathMap).map(
    ([id, model]) => ({ id, model, weight: 1, adjacency: {} })
  );

  // Step 3: Load all models once using GLBTileLoader
  const tileLoader = new GLBTileLoader();
  const modelData = await tileLoader.loadTileset(minimalTileset);

  console.log(`Loaded ${modelData.size} models into cache`);

  // Step 4: Load adjacency data and apply to models
  const adjLoader = new GLBAdjacencyLoader();
  const tileset = await adjLoader.applyToModels(
    "./adjacency-config.glb",
    modelPathMap,
    modelData // Pass pre-loaded models to avoid reloading
  );

  return { tileset, modelData };
}

// ============================================
// Method 3: Merge with existing tileset
// ============================================

async function mergeWithExisting(existingTileset: ModelTile3DConfig[]) {
  const loader = new GLBAdjacencyLoader();

  // This will update the adjacency rules in your existing tileset
  // while preserving model paths, materials, transforms, etc.
  const updatedTileset = await loader.loadAndMerge(
    "./adjacency-config.glb",
    existingTileset
  );

  return updatedTileset;
}

// ============================================
// Method 4: Manual creation with builder output
// ============================================

// Copy the JSON output from the builder and paste it here
export const manualTileset: ModelTile3DConfig[] = [
  {
    id: "spiral-staircase",
    weight: 1,
    model: "./models/blocks/spiral-staircase.glb",
    adjacency: {
      up: ["air"],
      west: ["spiral-staircase-inverted"],
      // ... other directions
    },
  },
  {
    id: "spiral-staircase-inverted",
    weight: 1,
    model: "./models/blocks/spiral-staircase.glb",
    adjacency: {
      up: ["air"],
      east: ["spiral-staircase"],
      // ... other directions
    },
    scale: { x: -1, y: 1, z: 1 }, // Mirror on X axis
  },
  // ... more tiles
];

// ============================================
// Method 5: Programmatic adjacency building
// ============================================

// You can also build adjacencies programmatically
function createTilesetProgrammatically(): ModelTile3DConfig[] {
  const baseTiles: ModelTile3DConfig[] = [
    {
      id: "base",
      weight: 10,
      model: "./models/base.glb",
      adjacency: {},
    },
    {
      id: "wall",
      weight: 5,
      model: "./models/wall.glb",
      adjacency: {},
    },
    {
      id: "air",
      weight: 20,
      model: "./models/air.glb",
      adjacency: {},
    },
  ];

  // Define adjacency rules
  baseTiles[0].adjacency = {
    up: ["wall", "air"],
    down: ["base"],
    north: ["base", "air"],
    south: ["base", "air"],
    east: ["base", "air"],
    west: ["base", "air"],
  };

  baseTiles[1].adjacency = {
    up: ["wall", "air"],
    down: ["base", "wall"],
    north: ["wall", "air"],
    south: ["wall", "air"],
    east: ["wall", "air"],
    west: ["wall", "air"],
  };

  baseTiles[2].adjacency = {
    up: ["air"],
    down: ["air", "wall", "base"],
    north: ["air"],
    south: ["air"],
    east: ["air"],
    west: ["air"],
  };

  return baseTiles;
}

// ============================================
// Using the tileset with WFC
// ============================================

async function generateWithBuiltAdjacency() {
  const { WFCGenerator } = await import("../../src/generators/WFCGenerator");

  // Use any of the methods above to get your tileset
  const tileset = await loadFromGLB();

  // Create generator
  const generator = new WFCGenerator(tileset, {
    workerCount: 4,
    maxRetries: 3,
  });

  // Generate
  const grid = await generator.generate(20, 10, 20, {
    onProgress: (progress) => console.log(`${(progress * 100).toFixed(1)}%`),
  });

  // Clean up
  generator.dispose();

  return grid;
}

// ============================================
// Complete Example: Following demo.ts pattern
// ============================================

/**
 * Complete example showing how to use GLBAdjacencyLoader with pre-loaded models
 * This follows the same pattern as examples/models/demo.ts
 */
async function completeExample() {
  const {
    WFCGenerator,
    GLBTileLoader,
    GLBAdjacencyLoader,
    InstancedModelRenderer,
  } = await import("../../src");

  // Step 1: Define model paths for your tiles
  const modelPathMap = {
    "spiral-staircase": "./models/blocks/spiral-staircase.glb",
    "spiral-staircase-inverted": "./models/blocks/spiral-staircase.glb",
    "square-roof": "./models/blocks/square-roof.glb",
    "corner-inverted": "./models/blocks/corner-inverted.glb",
    "handrail-entrance": "./models/blocks/handrail-entrance.glb",
  };

  // Step 2: Load adjacency configuration from GLB
  const adjLoader = new GLBAdjacencyLoader();
  const tileset = await adjLoader.applyToModels(
    "./adjacency-config.glb",
    modelPathMap
  );

  // Step 3: Load GLB models (following demo.ts pattern)
  const glbLoader = new GLBTileLoader();
  const modelData = await glbLoader.loadTileset(tileset);

  console.log("✅ Loaded models:", modelData.size);
  console.log("✅ Loaded adjacencies for", tileset.length, "tiles");

  // Step 4: Generate with WFC
  const generator = new WFCGenerator(tileset, {
    workerCount: 4,
    maxRetries: 3,
  });

  const grid = await generator.generate(20, 10, 20, {
    onProgress: (progress) => {
      console.log(`Generating: ${(progress * 100).toFixed(1)}%`);
    },
  });

  if (!grid) {
    console.error("Generation failed!");
    return;
  }

  console.log("✅ Generation complete!");

  // Step 5: Render (assuming you have a scene setup)
  // const renderer = new InstancedModelRenderer(scene, modelData, cellSize);
  // renderer.render(grid);

  generator.dispose();

  return { tileset, modelData, grid };
}

// ============================================
// Optimized Pattern: Load models once, reuse for multiple generations
// ============================================

async function optimizedPattern() {
  const { GLBTileLoader, GLBAdjacencyLoader, InstancedModelRenderer } =
    await import("../../src");

  // Define model paths
  const modelPathMap = {
    block: "./models/block.glb",
    base: "./models/base.glb",
    air: "./models/air.glb",
  };

  // Create minimal tileset for loading models
  const minimalTileset = Object.entries(modelPathMap).map(([id, model]) => ({
    id,
    model,
    weight: 1,
    adjacency: {},
  }));

  // Load models once
  const tileLoader = new GLBTileLoader();
  const modelData = await tileLoader.loadTileset(minimalTileset);

  console.log("📦 Models loaded and cached");

  // Load adjacency data
  const adjLoader = new GLBAdjacencyLoader();
  const tileset = await adjLoader.applyToModels(
    "./adjacency-config.glb",
    modelPathMap,
    modelData // Reuse loaded models
  );

  console.log("📋 Adjacency rules applied");

  // Now you can generate multiple times without reloading models
  // The GLBTileLoader caches the models internally

  return { tileset, modelData };
}

// ============================================
// Tips for building good adjacencies
// ============================================

/**
 * 1. Start with common/base tiles
 *    - Ground tiles, air tiles, basic building blocks
 *    - These form the foundation of your tileset
 *
 * 2. Use the Adjacency Builder for visual confirmation
 *    - It's easy to make mistakes with complex 3D relationships
 *    - Visual inspection catches errors early
 *
 * 3. Test frequently
 *    - Generate small grids to test your rules
 *    - Look for contradictions or unwanted patterns
 *
 * 4. Use weights strategically
 *    - Higher weights = more common in generation
 *    - Air/empty tiles usually need high weights
 *    - Special features should have low weights
 *
 * 5. Consider symmetry
 *    - The Adjacency Builder enforces this automatically
 *    - If A can be north of B, B must be south of A
 *
 * 6. Start simple, add complexity
 *    - Begin with a few tiles and basic rules
 *    - Add more tiles and rules incrementally
 *    - Test after each addition
 */
