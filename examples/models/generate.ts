import { ModelDemo } from "./demo";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import { ModelTile3DConfig, WFC3DError } from "../../src/wfc3d";
import { prepareTilesForWorker } from "../../src/utils";
import { WorkerPool } from "../../src/utils/WorkerPool";

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
  error?: WFC3DError;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

// Store the last generated grid and buffer for expansion/shrinking
let lastGeneratedGrid: string[][][] | null = null;
let lastBuffer: any = null;

/**
 * Format WFC3DError for display
 */
function formatWFCError(error: WFC3DError): string {
  const parts: string[] = [];

  parts.push(error.message);

  if (error.location) {
    parts.push(
      `at (${error.location.x}, ${error.location.y}, ${error.location.z})`
    );
  }

  if (error.progress !== undefined) {
    const percent = (error.progress * 100).toFixed(1);
    parts.push(`[${percent}% complete]`);
  }

  if (error.cellsCollapsed !== undefined && error.totalCells !== undefined) {
    parts.push(`(${error.cellsCollapsed}/${error.totalCells} cells)`);
  }

  if (error.details) {
    parts.push(`- ${error.details}`);
  }

  return parts.join(" ");
}

export default async function generate(
  modelDemo: ModelDemo,
  tiles: ModelTile3DConfig[],
  isExpansion: boolean = false,
  maxRetries: number = 3
): Promise<void> {
  if (modelDemo.isLoading) return;

  let attempt = 0;
  let lastError: Error | null = null;

  const ui = modelDemo.ui;

  modelDemo.isLoading = true;
  ui.progressContainer.classList.add("visible");
  ui.generateBtn.disabled = true;
  ui.randomBtn.disabled = true;

  // Retry loop
  while (attempt < maxRetries) {
    attempt++;

    try {
      // Show attempt number if retrying
      const attemptText =
        attempt > 1 ? ` (Attempt ${attempt}/${maxRetries})` : "";
      ui.progressContainer.querySelector(
        ".progress-label"
      )!.textContent = `Loading models...${attemptText}`;
      ui.progressFill.style.width = "0%";
      ui.progressFill.style.backgroundColor = "#4ade80"; // Reset color
      // Load models
      ui.progressContainer.querySelector(".progress-label")!.textContent =
        "Loading GLB models...";
      const modelData = await modelDemo.glbLoader.loadTileset(tiles);
      ui.progressFill.style.width = "30%";

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

      // Create worker if not exists
      if (!modelDemo.worker) {
        modelDemo.worker = new Worker(
          new URL("../../src/wfc.worker.ts", import.meta.url),
          { type: "module" }
        );
      }

      let result: string[][][];

      // Check if this is an expansion
      if (isExpansion && lastGeneratedGrid && lastBuffer) {
        // Calculate expansion amounts
        const expansions = {
          xMin: 0,
          xMax: Math.max(0, modelDemo.width - lastGeneratedGrid.length),
          yMin: 0,
          yMax: Math.max(
            0,
            modelDemo.height - (lastGeneratedGrid[0]?.length || 0)
          ),
          zMin: 0,
          zMax: Math.max(
            0,
            modelDemo.depth - (lastGeneratedGrid[0]?.[0]?.length || 0)
          ),
        };

        // Run expansion
        ui.progressContainer.querySelector(".progress-label")!.textContent =
          "Expanding grid...";
        result = await new Promise<string[][][]>((resolve, reject) => {
          if (!modelDemo.worker)
            return reject(new Error("Worker not initialized"));

          modelDemo.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const message = e.data;

            if (message.type === "progress") {
              const progress = 30 + message.progress * 60; // 30-90%
              ui.progressFill.style.width = `${progress}%`;
            } else if (message.type === "complete") {
              if (message.success && message.data) {
                resolve(message.data);
              } else {
                reject(new Error("Expansion failed - contradiction occurred"));
              }
            } else if (message.type === "error") {
              const error: any = new Error(message.message);
              if (message.error) {
                error.wfcError = message.error;
              }
              reject(error);
            }
          };

          // Send expansion request
          modelDemo.worker.postMessage({
            type: "expand",
            existingBuffer: lastBuffer,
            expansions,
            tiles: prepareTilesForWorker(tiles),
            seed: modelDemo.currentSeed,
          });
        });
      } else {
        // Run full WFC generation
        ui.progressContainer.querySelector(".progress-label")!.textContent =
          "Running WFC algorithm...";
        result = await new Promise<string[][][]>((resolve, reject) => {
          if (!modelDemo.worker)
            return reject(new Error("Worker not initialized"));

          modelDemo.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const message = e.data;

            if (message.type === "progress") {
              const progress = 30 + message.progress * 60; // 30-90%
              ui.progressFill.style.width = `${progress}%`;
            } else if (message.type === "complete") {
              if (message.success && message.data) {
                resolve(message.data);
              } else {
                reject(new Error("Generation failed - contradiction occurred"));
              }
            } else if (message.type === "error") {
              const error: any = new Error(message.message);
              if (message.error) {
                error.wfcError = message.error;
              }
              reject(error);
            }
          };

          // Send generation request
          modelDemo.worker.postMessage({
            type: "generate",
            width: modelDemo.width,
            height: modelDemo.height,
            depth: modelDemo.depth,
            tiles: prepareTilesForWorker(tiles),
            seed: modelDemo.currentSeed,
          });
        });
      }

      // Render using instanced meshes
      ui.progressContainer.querySelector(".progress-label")!.textContent =
        "Rendering instances...";
      ui.progressFill.style.width = "95%";

      // Filter out 'air' tiles before rendering
      const filteredGrid = result.map((xLayer) =>
        xLayer.map((yLayer) =>
          yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
        )
      );

      // Store for future expansion
      lastGeneratedGrid = result;
      // Note: We'd need to get the actual buffer from the worker for full expansion support
      // For now, we'll serialize the grid data
      lastBuffer = {
        width: modelDemo.width,
        height: modelDemo.height,
        depth: modelDemo.depth,
        cellData: [],
      };

      // Serialize the result into buffer format
      for (let x = 0; x < result.length; x++) {
        for (let y = 0; y < result[x].length; y++) {
          for (let z = 0; z < result[x][y].length; z++) {
            const tileId = result[x][y][z];
            lastBuffer.cellData.push({
              x,
              y,
              z,
              collapsed: true,
              tileId,
              possibleTiles: [tileId],
            });
          }
        }
      }

      modelDemo.modelRenderer.updateGrid(filteredGrid);

      const stats = modelDemo.modelRenderer.getStats();
      ui.progressContainer.querySelector(
        ".progress-label"
      )!.textContent = `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`;
      ui.progressFill.style.width = "100%";

      setTimeout(() => {
        ui.progressContainer.classList.remove("visible");
      }, 2000);

      // Success! Exit retry loop
      modelDemo.isLoading = false;
      ui.generateBtn.disabled = false;
      ui.randomBtn.disabled = false;
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Generation error (attempt ${attempt}/${maxRetries}):`,
        error
      );

      // Check if error has WFC3DError details
      const wfcError = (error as any).wfcError as WFC3DError | undefined;
      if (wfcError) {
        console.error("WFC Error Details:", wfcError);
      }

      // If we have retries left and it's a contradiction, try again with new seed
      if (attempt < maxRetries && wfcError?.type) {
        ui.progressContainer.querySelector(
          ".progress-label"
        )!.textContent = `Contradiction detected. Retrying with new seed... (${attempt}/${maxRetries})`;
        ui.progressFill.style.width = "0%";
        ui.progressFill.style.backgroundColor = "#ff9800"; // Orange for retry

        // Use a new random seed for retry
        modelDemo.currentSeed = Date.now() + attempt;

        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue; // Try again
      }

      // No more retries or non-recoverable error
      break;
    }
  }

  // All retries exhausted - show final error
  if (lastError) {
    let errorMessage = "Unknown error";
    if (lastError instanceof Error) {
      errorMessage = lastError.message;

      const wfcError = (lastError as any).wfcError as WFC3DError | undefined;
      if (wfcError) {
        errorMessage = formatWFCError(wfcError);
      }
    }

    ui.progressContainer.querySelector(
      ".progress-label"
    )!.textContent = `Failed after ${maxRetries} attempts: ${errorMessage}`;
    ui.progressFill.style.width = "0%";
    ui.progressFill.style.backgroundColor = "#ef4444";

    setTimeout(() => {
      ui.progressFill.style.backgroundColor = "#4ade80";
    }, 5000);
  }

  modelDemo.isLoading = false;
  ui.generateBtn.disabled = false;
  ui.randomBtn.disabled = false;
}

// Export helper to check if expansion is possible
export function canExpand(): boolean {
  return lastGeneratedGrid !== null && lastBuffer !== null;
}

// Export helper to reset expansion state
export function resetExpansionState(): void {
  lastGeneratedGrid = null;
  lastBuffer = null;
}

/**
 * Shrink the grid by removing tiles
 */
export async function shrinkGrid(
  modelDemo: ModelDemo,
  newWidth: number,
  newHeight: number,
  newDepth: number
): Promise<void> {
  if (!lastGeneratedGrid || !modelDemo.modelRenderer) {
    console.warn("No existing grid to shrink");
    return;
  }

  const ui = modelDemo.ui;

  try {
    // Show progress
    ui.progressContainer.classList.add("visible");
    ui.progressContainer.querySelector(".progress-label")!.textContent =
      "Shrinking grid...";
    ui.progressFill.style.width = "50%";

    // Create a new shrunk grid
    const shrunkGrid: string[][][] = [];

    // Copy only the cells within the new dimensions
    for (let x = 0; x < newWidth && x < lastGeneratedGrid.length; x++) {
      shrunkGrid[x] = [];
      for (let y = 0; y < newHeight && y < lastGeneratedGrid[x].length; y++) {
        shrunkGrid[x][y] = [];
        for (
          let z = 0;
          z < newDepth && z < lastGeneratedGrid[x][y].length;
          z++
        ) {
          shrunkGrid[x][y][z] = lastGeneratedGrid[x][y][z];
        }
      }
    }

    // Update the last generated grid and buffer
    lastGeneratedGrid = shrunkGrid;
    lastBuffer = {
      width: newWidth,
      height: newHeight,
      depth: newDepth,
      cellData: [],
    };

    // Rebuild cell data for the buffer
    for (let x = 0; x < shrunkGrid.length; x++) {
      for (let y = 0; y < shrunkGrid[x].length; y++) {
        for (let z = 0; z < shrunkGrid[x][y].length; z++) {
          const tileId = shrunkGrid[x][y][z];
          lastBuffer.cellData.push({
            x,
            y,
            z,
            collapsed: true,
            tileId,
            possibleTiles: [tileId],
          });
        }
      }
    }

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

    ui.progressFill.style.width = "100%";
    const stats = modelDemo.modelRenderer.getStats();
    ui.progressContainer.querySelector(
      ".progress-label"
    )!.textContent = `Shrunk! ${stats.totalInstances} instances, ${stats.tileTypes} types`;

    setTimeout(() => {
      ui.progressContainer.classList.remove("visible");
    }, 1000);
  } catch (error) {
    console.error("Shrink error:", error);
    ui.progressContainer.classList.remove("visible");
  }
}
