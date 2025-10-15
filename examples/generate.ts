import Demo from "./template";
import { InstancedModelRenderer } from "../src/renderers/InstancedModelRenderer";
import { ModelTile3DConfig } from "../src/wfc3d";
import { WFCGenerator } from "../src/generators/WFCGenerator";
import {
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
} from "../src/utils/DemoUI";
import { AdjacencyDemo } from "./adjacency-demo/demo";

// Global generator instance
let generator: WFCGenerator | null = null;

export default async function generate(
  modelDemo: Demo | AdjacencyDemo,
  tiles: ModelTile3DConfig[],
  isExpansion: boolean = false
): Promise<void> {
  const ui = modelDemo.ui;

  // Create or update generator
  if (!generator) {
    generator = new WFCGenerator(tiles, {
      workerCount: modelDemo.useWorkers ? modelDemo.workerCount : 1,
      maxRetries: 3,
      autoExpansion: true,
      seed: modelDemo.currentSeed,
    });
  } else {
    // Update tiles and seed
    generator.setTiles(tiles);
    generator.setSeed(modelDemo.currentSeed);
  }

  try {
    // Load models
    showProgress(ui, "Loading GLB models...");
    setProgress(ui, 0);
    const modelData = await modelDemo.glbLoader.loadTileset(tiles);
    setProgress(ui, 10);

    // Clear existing renderer if starting fresh
    if (modelDemo.modelRenderer && !isExpansion) {
      modelDemo.modelRenderer.dispose();
      modelDemo.modelRenderer = null;
    }

    // Create new renderer with loaded models if needed
    if (!modelDemo.modelRenderer) {
      modelDemo.modelRenderer = new InstancedModelRenderer(
        modelDemo.scene,
        modelData,
        modelDemo.cellSize
      );
    }

    // Set offset to center the grid
    modelDemo.modelRenderer.setOffset(
      (-modelDemo.width * modelDemo.cellSize) / 2,
      (-modelDemo.height * modelDemo.cellSize) / 2,
      (-modelDemo.depth * modelDemo.cellSize) / 2
    );

    // Internal grid for real-time rendering
    const internalGrid: string[][][] = Array(modelDemo.width)
      .fill(null)
      .map(() =>
        Array(modelDemo.height)
          .fill(null)
          .map(() => Array(modelDemo.depth).fill(""))
      );

    // Set up callbacks for real-time rendering
    const onTileUpdate = (x: number, y: number, z: number, tileId: string) => {
      // Update internal grid
      if (
        x >= 0 &&
        x < modelDemo.width &&
        y >= 0 &&
        y < modelDemo.height &&
        z >= 0 &&
        z < modelDemo.depth
      ) {
        internalGrid[x][y][z] = tileId;

        // Update renderer in real-time (filter out air tiles)
        if (tileId && tileId !== "air" && modelDemo.modelRenderer) {
          const filteredGrid = internalGrid.map((xLayer) =>
            xLayer.map((yLayer) => yLayer.map((t) => (t === "air" ? "" : t)))
          );
          modelDemo.modelRenderer.updateGrid(filteredGrid);
        }
      }
    };

    const onProgress = (progress: number) => {
      const displayProgress = 10 + progress * 85; // 10-95%
      setProgress(ui, displayProgress);
    };

    let result: string[][][];

    // Check if this is an expansion
    if (isExpansion && generator.canExpand()) {
      showProgress(ui, "Expanding grid...");

      result = await generator.expand(
        modelDemo.width,
        modelDemo.height,
        modelDemo.depth,
        {
          onProgress,
          onTileUpdate,
        }
      );
    } else {
      showProgress(ui, "Running WFC algorithm...");

      result = await generator.generate(
        modelDemo.width,
        modelDemo.height,
        modelDemo.depth,
        {
          onProgress,
          onTileUpdate,
        }
      );
    }

    // Final update
    showProgress(ui, "Finalizing...");
    setProgress(ui, 95);

    // Do a final render to ensure everything is up to date
    const filteredGrid = result.map((xLayer) =>
      xLayer.map((yLayer) =>
        yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
      )
    );

    if (modelDemo.modelRenderer) {
      modelDemo.modelRenderer.updateGrid(filteredGrid);
    }

    // Update debug grid
    modelDemo.debugGrid.updateGrid(
      modelDemo.width,
      modelDemo.height,
      modelDemo.depth
    );

    const stats = modelDemo.modelRenderer.getStats();
    console.log(
      `✅ Generation complete! ${stats.totalInstances} instances rendered in real-time across ${stats.tileTypes} tile types.`
    );

    showProgress(
      ui,
      `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types (rendered in real-time)`
    );
    setProgress(ui, 100);

    setTimeout(() => {
      hideProgress(ui);
    }, 2000);

    modelDemo.isLoading = false;
  } catch (error) {
    console.error("Generation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    showProgress(ui, `Failed: ${errorMessage}`);
    setProgress(ui, 0);
    setProgressColor(ui, "#ef4444");

    setTimeout(() => {
      setProgressColor(ui, "var(--focus-color)");
      hideProgress(ui);
    }, 3000);

    modelDemo.isLoading = false;
  }
}

// Export helper to check if expansion is possible
export function canExpand(): boolean {
  return generator !== null && generator.canExpand();
}

// Export helper to reset expansion state
export function resetExpansionState(): void {
  if (generator) {
    generator.reset();
  }
}

/**
 * Shrink the grid by removing tiles
 */
export async function shrinkGrid(
  modelDemo: Demo,
  newWidth: number,
  newHeight: number,
  newDepth: number
): Promise<void> {
  if (!generator || !generator.canExpand() || !modelDemo.modelRenderer) {
    console.warn("No existing grid to shrink");
    return;
  }

  const ui = modelDemo.ui;

  try {
    // Show progress
    showProgress(ui, "Shrinking grid...");
    setProgress(ui, 50);

    // Use generator's shrink method
    const shrunkGrid = generator.shrink(newWidth, newHeight, newDepth);

    // Update renderer offset
    modelDemo.modelRenderer.setOffset(
      (-newWidth * modelDemo.cellSize) / 2,
      (-newHeight * modelDemo.cellSize) / 2,
      (-newDepth * modelDemo.cellSize) / 2
    );

    // Filter out 'air' tiles before rendering
    const filteredGrid = shrunkGrid.map((xLayer) =>
      xLayer.map((yLayer) =>
        yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
      )
    );

    // Update the renderer with the shrunk grid
    modelDemo.modelRenderer.updateGrid(filteredGrid);

    // Update debug grid
    modelDemo.debugGrid.updateGrid(newWidth, newHeight, newDepth);

    setProgress(ui, 100);
    const stats = modelDemo.modelRenderer.getStats();
    showProgress(
      ui,
      `Shrunk! ${stats.totalInstances} instances, ${stats.tileTypes} types`
    );

    setTimeout(() => {
      hideProgress(ui);
    }, 1000);
  } catch (error) {
    console.error("Shrink error:", error);
    hideProgress(ui);
  }
}
