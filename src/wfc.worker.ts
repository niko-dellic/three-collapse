import {
  WFC3D,
  WFCTile3D,
  type WFCTile3DConfig,
  WFC3DBuffer,
  type SerializedBuffer,
  type WFC3DError,
} from "./wfc3d";

interface GenerateMessage {
  type: "generate";
  width: number;
  height: number;
  depth: number;
  tiles: WFCTile3DConfig[];
  seed?: number;
  region?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
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
  tiles: WFCTile3DConfig[];
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

      // Apply pre-collapsed cells if provided
      if (message.preCollapsedCells) {
        for (const cellData of message.preCollapsedCells) {
          const cell = wfc.buffer.getCell(cellData.x, cellData.y, cellData.z);
          if (cell) {
            cell.collapse(cellData.tileId);
          }
        }
      }

      // Run generation with progress and tile updates
      const success = await wfc.generate(
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
