import { WFC3D, WFCTile3D, type WFCTile3DConfig } from './wfc3d';

interface GenerateMessage {
  type: 'generate';
  width: number;
  height: number;
  depth: number;
  tiles: WFCTile3DConfig[];
  seed?: number;
}

interface ProgressMessage {
  type: 'progress';
  progress: number;
}

interface CompleteMessage {
  type: 'complete';
  success: boolean;
  data?: string[][][];
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WorkerMessage = GenerateMessage;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  if (message.type === 'generate') {
    try {
      // Create tiles from configs
      const tiles = message.tiles.map(config => new WFCTile3D(config));

      // Create WFC instance
      const wfc = new WFC3D({
        width: message.width,
        height: message.height,
        depth: message.depth,
        tiles,
        seed: message.seed,
      });

      // Run generation with progress updates
      const success = await wfc.generate((progress) => {
        const progressMsg: ProgressMessage = {
          type: 'progress',
          progress,
        };
        self.postMessage(progressMsg);
      });

      if (success) {
        // Extract result data
        const data: string[][][] = [];
        for (let x = 0; x < message.width; x++) {
          data[x] = [];
          for (let y = 0; y < message.height; y++) {
            data[x][y] = [];
            for (let z = 0; z < message.depth; z++) {
              data[x][y][z] = wfc.buffer.getTileAt(x, y, z) || '';
            }
          }
        }

        const completeMsg: CompleteMessage = {
          type: 'complete',
          success: true,
          data,
        };
        self.postMessage(completeMsg);
      } else {
        const completeMsg: CompleteMessage = {
          type: 'complete',
          success: false,
        };
        self.postMessage(completeMsg);
      }
    } catch (error) {
      const errorMsg: ErrorMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      self.postMessage(errorMsg);
    }
  }
};
