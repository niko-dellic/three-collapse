import {
  WFC3D,
  WFCTile3D,
  type ModelTile3DConfig,
  WFC3DBuffer,
  type SerializedBuffer,
  type WFC3DError,
} from "./wfc3d";

interface GenerateMessage {
  type: "generate";
  width: number;
  height: number;
  depth: number;
  tiles: ModelTile3DConfig[];
  seed?: number;
  region?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
  assignedCells?: Array<[number, number, number]>; // NEW: Specific cells to collapse
  preCollapsedCells?: Array<{
    x: number;
    y: number;
    z: number;
    tileId: string;
  }>;
}

interface ExpandMessage {
  type: "expand";
  existingBuffer: SerializedBuffer;
  expansions: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
  tiles: ModelTile3DConfig[];
  seed?: number;
}

interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface TileUpdateMessage {
  type: "tile_update";
  x: number;
  y: number;
  z: number;
  tileId: string;
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

type WorkerMessage = GenerateMessage | ExpandMessage;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  if (message.type === "generate") {
    try {
      // Create tiles from configs
      const tiles = message.tiles.map((config) => new WFCTile3D(config));

      // Create WFC instance
      const wfc = new WFC3D({
        width: message.width,
        height: message.height,
        depth: message.depth,
        tiles,
        seed: message.seed,
      });

      // Apply pre-collapsed cells if provided (boundaries)
      if (message.preCollapsedCells) {
        for (const cellData of message.preCollapsedCells) {
          const cell = wfc.buffer.getCell(cellData.x, cellData.y, cellData.z);
          if (cell) {
            cell.collapse(cellData.tileId);
          }
        }
      }

      let success: boolean;

      // If assignedCells provided, only collapse those specific cells
      if (message.assignedCells !== undefined) {
        // Worker has been given a specific cell assignment (may be empty for all-boundary regions)
        if (message.assignedCells.length === 0) {
          // No interior cells to collapse - this region is all boundaries
          console.log(
            "Worker has no assigned cells (all-boundary region), skipping"
          );
          success = true;
        } else {
          // Collapse assigned cells
          const totalCells = message.assignedCells.length;
          let collapsedCount = 0;
          let skippedPreCollapsed = 0;
          const skippedCells: Array<[number, number, number]> = [];
          const actuallyCollapsed: Array<[number, number, number, string]> = [];

          // Create a Set of assigned cell keys for quick lookup
          const assignedSet = new Set(
            message.assignedCells.map(([x, y, z]) => `${x},${y},${z}`)
          );

          // Collapse only assigned cells
          for (const [x, y, z] of message.assignedCells) {
            const cell = wfc.buffer.getCell(x, y, z);

            // Skip if already collapsed (e.g., pre-collapsed boundary)
            if (!cell || cell.collapsed) {
              collapsedCount++;
              skippedPreCollapsed++;
              skippedCells.push([x, y, z]);
              continue; // Don't send tile update for pre-collapsed cells
            }

            // Collapse this specific cell (may trigger propagation to neighbors)
            const tileId = wfc.collapseCell(x, y, z);

            if (tileId) {
              collapsedCount++;
              actuallyCollapsed.push([x, y, z, tileId]);

              // Send tile update for this assigned cell
              const tileMsg: TileUpdateMessage = {
                type: "tile_update",
                x,
                y,
                z,
                tileId,
              };
              self.postMessage(tileMsg);

              // Send progress
              const progressMsg: ProgressMessage = {
                type: "progress",
                progress: collapsedCount / totalCells,
              };
              self.postMessage(progressMsg);
            } else {
              // Contradiction - this shouldn't happen with proper boundaries
              throw new Error(`Contradiction at (${x}, ${y}, ${z})`);
            }
          }

          if (skippedPreCollapsed > 0) {
            console.warn(
              `Worker skipped ${skippedPreCollapsed} pre-collapsed cells that shouldn't have been assigned`
            );
            console.warn(
              `   First 10 skipped: ${skippedCells
                .slice(0, 10)
                .map((c) => `(${c[0]},${c[1]},${c[2]})`)
                .join(", ")}`
            );
          }

          success = true;
        }
      } else {
        // Fallback: run normal generate (for single worker case)
        success = await wfc.generate(
          (progress) => {
            const progressMsg: ProgressMessage = {
              type: "progress",
              progress,
            };
            self.postMessage(progressMsg);
          },
          (x, y, z, tileId) => {
            const tileMsg: TileUpdateMessage = {
              type: "tile_update",
              x,
              y,
              z,
              tileId,
            };
            self.postMessage(tileMsg);
          }
        );
      }

      if (success) {
        // Extract result data (only for the region if specified)
        const region = message.region || {
          xMin: 0,
          xMax: message.width,
          yMin: 0,
          yMax: message.height,
          zMin: 0,
          zMax: message.depth,
        };

        const data: string[][][] = [];
        for (let x = region.xMin; x < region.xMax; x++) {
          data[x - region.xMin] = [];
          for (let y = region.yMin; y < region.yMax; y++) {
            data[x - region.xMin][y - region.yMin] = [];
            for (let z = region.zMin; z < region.zMax; z++) {
              data[x - region.xMin][y - region.yMin][z - region.zMin] =
                wfc.buffer.getTileAt(x, y, z) || "";
            }
          }
        }

        const completeMsg: CompleteMessage = {
          type: "complete",
          success: true,
          data,
        };
        self.postMessage(completeMsg);
      } else {
        // Send error information from WFC
        const errorMsg: ErrorMessage = {
          type: "error",
          message: wfc.lastError?.message || "Generation failed",
          error: wfc.lastError || undefined,
        };
        self.postMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg: ErrorMessage = {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
      self.postMessage(errorMsg);
    }
  } else if (message.type === "expand") {
    try {
      // Create tiles from configs
      const tiles = message.tiles.map((config) => new WFCTile3D(config));

      // Deserialize existing buffer
      const existingBuffer = WFC3DBuffer.deserialize(
        message.existingBuffer,
        tiles
      );

      // Create WFC instance with existing buffer
      const wfc = new WFC3D({
        width: existingBuffer.width,
        height: existingBuffer.height,
        depth: existingBuffer.depth,
        tiles,
        seed: message.seed,
      });
      wfc.buffer = existingBuffer;

      // Run expansion with progress and tile updates
      const success = await wfc.expand(
        message.expansions,
        (progress) => {
          const progressMsg: ProgressMessage = {
            type: "progress",
            progress,
          };
          self.postMessage(progressMsg);
        },
        (x, y, z, tileId) => {
          const tileMsg: TileUpdateMessage = {
            type: "tile_update",
            x,
            y,
            z,
            tileId,
          };
          self.postMessage(tileMsg);
        }
      );

      if (success) {
        // Extract result data
        const data: string[][][] = [];
        for (let x = 0; x < wfc.buffer.width; x++) {
          data[x] = [];
          for (let y = 0; y < wfc.buffer.height; y++) {
            data[x][y] = [];
            for (let z = 0; z < wfc.buffer.depth; z++) {
              data[x][y][z] = wfc.buffer.getTileAt(x, y, z) || "";
            }
          }
        }

        const completeMsg: CompleteMessage = {
          type: "complete",
          success: true,
          data,
        };
        self.postMessage(completeMsg);
      } else {
        // Send error information from WFC
        const errorMsg: ErrorMessage = {
          type: "error",
          message: wfc.lastError?.message || "Expansion failed",
          error: wfc.lastError || undefined,
        };
        self.postMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg: ErrorMessage = {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
      self.postMessage(errorMsg);
    }
  }
};
