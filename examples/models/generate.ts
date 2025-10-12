import { ModelDemo } from "./demo";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import { ModelTile3DConfig } from "../../src/wfc3d";
import { prepareTilesForWorker } from "../../src/utils";

// Worker types
interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface CompleteMessage {
  type: "complete";
  success: boolean;
  data?: string[][][];
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

export default async function generate(
  modelDemo: ModelDemo,
  tiles: ModelTile3DConfig[]
): Promise<void> {
  if (modelDemo.isLoading) return;

  const statusContainer = modelDemo.statusContainer;
  const statusText = modelDemo.statusText;
  const progressFill = modelDemo.progressFill;
  const generateBtn = modelDemo.generateBtn;
  const randomBtn = modelDemo.randomBtn;

  modelDemo.isLoading = true;
  statusContainer.classList.add("visible");
  statusText.textContent = "Loading models...";
  progressFill.style.width = "0%";
  generateBtn.disabled = true;
  randomBtn.disabled = true;

  try {
    // Load models
    statusText.textContent = "Loading GLB models...";
    const modelData = await modelDemo.glbLoader.loadTileset(tiles);
    progressFill.style.width = "30%";

    // Clear existing renderer
    if (modelDemo.modelRenderer) {
      modelDemo.modelRenderer.dispose();
    }

    // Create new renderer with loaded models
    modelDemo.modelRenderer = new InstancedModelRenderer(
      modelDemo.scene,
      modelData,
      modelDemo.cellSize
    );

    // Set offset to center the grid
    modelDemo.modelRenderer.setOffset(
      (-modelDemo.width * modelDemo.cellSize) / 2,
      (-modelDemo.height * modelDemo.cellSize) / 2,
      (-modelDemo.depth * modelDemo.cellSize) / 2
    );

    // Create worker if not exists
    if (!modelDemo.worker) {
      modelDemo.worker = new Worker(
        new URL("../../src/wfc.worker.ts", import.meta.url),
        { type: "module" }
      );
    }

    // Run WFC algorithm
    statusText.textContent = "Running WFC algorithm...";
    const result = await new Promise<string[][][]>((resolve, reject) => {
      if (!modelDemo.worker) return reject(new Error("Worker not initialized"));

      modelDemo.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const message = e.data;

        if (message.type === "progress") {
          const progress = 30 + message.progress * 60; // 30-90%
          progressFill.style.width = `${progress}%`;
        } else if (message.type === "complete") {
          if (message.success && message.data) {
            resolve(message.data);
          } else {
            reject(new Error("Generation failed - contradiction occurred"));
          }
        } else if (message.type === "error") {
          reject(new Error(message.message));
        }
      };

      // Send generation request
      // Strip out 'model' property since functions can't be cloned to worker
      modelDemo.worker.postMessage({
        type: "generate",
        width: modelDemo.width,
        height: modelDemo.height,
        depth: modelDemo.depth,
        tiles: prepareTilesForWorker(tiles),
        seed: modelDemo.currentSeed,
      });
    });

    // Render using instanced meshes
    statusText.textContent = "Rendering instances...";
    progressFill.style.width = "95%";

    // Filter out 'air' tiles before rendering
    const filteredGrid = result.map((xLayer) =>
      xLayer.map((yLayer) =>
        yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
      )
    );

    modelDemo.modelRenderer.render(filteredGrid);

    const stats = modelDemo.modelRenderer.getStats();
    statusText.textContent = `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`;
    progressFill.style.width = "100%";

    setTimeout(() => {
      statusContainer.classList.remove("visible");
    }, 2000);
  } catch (error) {
    console.error("Generation error:", error);
    statusText.textContent = `Error: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    progressFill.style.width = "0%";
    progressFill.style.backgroundColor = "#ef4444";

    setTimeout(() => {
      progressFill.style.backgroundColor = "#4ade80";
    }, 3000);
  } finally {
    modelDemo.isLoading = false;
    generateBtn.disabled = false;
    randomBtn.disabled = false;
  }
}
