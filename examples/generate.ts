import { ModelTile3DConfig } from "../src/wfc3d";
import { WFCGenerator } from "../src/generators/WFCGenerator";
import { AdjacencyDemo } from "./adjacency-demo/demo";

// Global generator instance
let generator: WFCGenerator | null = null;

export default async function generate(
  modelDemo: AdjacencyDemo,
  tiles: ModelTile3DConfig[],
  isExpansion: boolean = false
): Promise<void> {
  try {
    // Create or update generator
    if (!generator) {
      generator = new WFCGenerator(tiles, {
        workerCount: modelDemo.useWorkers ? modelDemo.workerCount : 1,
        maxRetries: 3,
        autoExpansion: true,
        seed: modelDemo.currentSeed,
        scene: modelDemo.scene,
        cellSize: modelDemo.cellSize,
        width: modelDemo.width,
        height: modelDemo.height,
        depth: modelDemo.depth,
        debug: true,
      });
    } else {
      // Update tiles and seed
      generator.setTiles(tiles);
      generator.setSeed(modelDemo.currentSeed);
    }

    // Collapse (solve) - the generator handles model loading, progress updates, and rendering internally
    if (isExpansion && generator.canExpand()) {
      await generator.expand(
        modelDemo.width,
        modelDemo.height,
        modelDemo.depth
      );
    } else {
      await generator.collapse({
        width: modelDemo.width,
        height: modelDemo.height,
        depth: modelDemo.depth,
        loader: modelDemo.glbLoader,
        offset: {
          x: (-modelDemo.width * modelDemo.cellSize) / 2,
          y: (-modelDemo.height * modelDemo.cellSize) / 2,
          z: (-modelDemo.depth * modelDemo.cellSize) / 2,
        },
      });
    }

    const renderer = generator.getRenderer();
    if (renderer) {
      const stats = renderer.getStats();
      console.log(
        `✅ Generation complete! ${stats.totalInstances} instances rendered in real-time across ${stats.tileTypes} tile types.`
      );
    }

    modelDemo.isLoading = false;
  } catch (error) {
    console.error("Generation error:", error);
    modelDemo.isLoading = false;
  }
}

// Export helper to get the generator instance
export function getGenerator(): WFCGenerator | null {
  return generator;
}
