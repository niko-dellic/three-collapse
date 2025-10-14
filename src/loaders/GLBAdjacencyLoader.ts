import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelTile3DConfig } from "../wfc3d";
import type { LoadedModelData } from "./GLBTileLoader";

export interface GLBAdjacencyData {
  configs: ModelTile3DConfig[];
  scene: THREE.Group;
}

/**
 * Helper class to load adjacency data from GLB files exported by the adjacency builder
 *
 * This loader can import adjacency configurations that were exported from the adjacency
 * builder tool, which stores tile relationships in the GLB file's userData.
 *
 * @example
 * ```typescript
 * import { GLBAdjacencyLoader } from "three-collapse";
 *
 * const loader = new GLBAdjacencyLoader();
 *
 * // Load from URL
 * const { configs, scene } = await loader.load("./adjacency-config.glb");
 *
 * // Or merge with existing tileset
 * const updatedTileset = await loader.loadAndMerge(
 *   "./adjacency-config.glb",
 *   existingTileset
 * );
 * ```
 */
export class GLBAdjacencyLoader {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load a GLB file and extract adjacency configuration
   *
   * @param url - Path to the GLB file
   * @returns Promise resolving to adjacency data and scene
   * @throws Error if no adjacency data is found in the GLB file
   */
  async load(url: string): Promise<GLBAdjacencyData> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const scene = gltf.scene;
          const adjacencyData = scene.userData.adjacencyData;

          if (!adjacencyData) {
            reject(new Error("No adjacency data found in GLB file"));
            return;
          }

          const configs: ModelTile3DConfig[] = [];

          // Extract tile data from scene userData
          for (const [tileId, data] of Object.entries(adjacencyData)) {
            const tileData = data as any;

            const config: ModelTile3DConfig = {
              id: tileId,
              weight: tileData.weight || 1,
              // For now, we can't reconstruct the original model path or function
              // So we use a placeholder - users will need to map this manually
              model: `[Reconstructed from GLB: ${tileId}]`,
              adjacency: {
                up:
                  tileData.adjacency.up?.length > 0
                    ? tileData.adjacency.up
                    : undefined,
                down:
                  tileData.adjacency.down?.length > 0
                    ? tileData.adjacency.down
                    : undefined,
                north:
                  tileData.adjacency.north?.length > 0
                    ? tileData.adjacency.north
                    : undefined,
                south:
                  tileData.adjacency.south?.length > 0
                    ? tileData.adjacency.south
                    : undefined,
                east:
                  tileData.adjacency.east?.length > 0
                    ? tileData.adjacency.east
                    : undefined,
                west:
                  tileData.adjacency.west?.length > 0
                    ? tileData.adjacency.west
                    : undefined,
              },
            };

            // Remove empty adjacency
            if (
              Object.values(config.adjacency!).every((v) => v === undefined)
            ) {
              config.adjacency = {};
            }

            configs.push(config);
          }

          resolve({ configs, scene });
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Load from a File object (for file upload)
   *
   * @param file - File object from file input
   * @returns Promise resolving to adjacency data and scene
   */
  async loadFromFile(file: File): Promise<GLBAdjacencyData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error("Failed to read file"));
            return;
          }

          // Parse the GLB directly from ArrayBuffer
          this.loader.parse(
            arrayBuffer,
            "",
            (gltf) => {
              const scene = gltf.scene;
              const adjacencyData = scene.userData.adjacencyData;

              if (!adjacencyData) {
                reject(new Error("No adjacency data found in GLB file"));
                return;
              }

              const configs: ModelTile3DConfig[] = [];

              // Extract tile data from scene userData
              for (const [tileId, data] of Object.entries(adjacencyData)) {
                const tileData = data as any;

                const config: ModelTile3DConfig = {
                  id: tileId,
                  weight: tileData.weight || 1,
                  model: `[Reconstructed from GLB: ${tileId}]`,
                  adjacency: {
                    up:
                      tileData.adjacency.up?.length > 0
                        ? tileData.adjacency.up
                        : undefined,
                    down:
                      tileData.adjacency.down?.length > 0
                        ? tileData.adjacency.down
                        : undefined,
                    north:
                      tileData.adjacency.north?.length > 0
                        ? tileData.adjacency.north
                        : undefined,
                    south:
                      tileData.adjacency.south?.length > 0
                        ? tileData.adjacency.south
                        : undefined,
                    east:
                      tileData.adjacency.east?.length > 0
                        ? tileData.adjacency.east
                        : undefined,
                    west:
                      tileData.adjacency.west?.length > 0
                        ? tileData.adjacency.west
                        : undefined,
                  },
                };

                if (
                  Object.values(config.adjacency!).every((v) => v === undefined)
                ) {
                  config.adjacency = {};
                }

                configs.push(config);
              }

              resolve({ configs, scene: gltf.scene });
            },
            (error) => {
              reject(error);
            }
          );
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Load and merge with existing tileset
   *
   * Useful for importing adjacency data and mapping to actual model paths.
   * This updates the weight and adjacency properties of matching tiles in the existing tileset.
   *
   * @param url - Path to the GLB file
   * @param existingTileset - Existing tileset to merge adjacency data into
   * @returns Promise resolving to updated tileset
   *
   * @example
   * ```typescript
   * const loader = new GLBAdjacencyLoader();
   * const myTileset = [
   *   { id: "block", model: "./models/block.glb", weight: 1, adjacency: {} },
   *   { id: "air", model: "./models/air.glb", weight: 5, adjacency: {} }
   * ];
   *
   * // Load adjacency rules from GLB and apply to tileset
   * const updated = await loader.loadAndMerge("./adjacency-config.glb", myTileset);
   * ```
   */
  async loadAndMerge(
    url: string,
    existingTileset: ModelTile3DConfig[]
  ): Promise<ModelTile3DConfig[]> {
    const { configs } = await this.load(url);

    const tileMap = new Map(existingTileset.map((t) => [t.id, t]));

    // Merge adjacency data into existing tileset
    for (const importedConfig of configs) {
      const existingTile = tileMap.get(importedConfig.id);
      if (existingTile) {
        // Update weight and adjacency from imported data
        existingTile.weight = importedConfig.weight;
        existingTile.adjacency = importedConfig.adjacency;
      }
    }

    return existingTileset;
  }

  /**
   * Apply adjacency data to a tileset with model paths, optionally using pre-loaded models
   *
   * This method is useful when you want to load adjacency configuration from a GLB
   * and apply it to tiles with actual model paths, potentially using already-loaded model data
   * to avoid reloading.
   *
   * @param url - Path to the adjacency GLB file
   * @param modelPathMap - Map of tile IDs to model file paths
   * @param loadedModels - Optional map of already loaded model data (from GLBTileLoader)
   * @returns Promise resolving to complete tileset with models and adjacencies
   *
   * @example
   * ```typescript
   * import { GLBAdjacencyLoader, GLBTileLoader } from "three-collapse";
   *
   * // Option 1: Without pre-loaded models
   * const adjLoader = new GLBAdjacencyLoader();
   * const tileset = await adjLoader.applyToModels(
   *   "./adjacency-config.glb",
   *   {
   *     "block": "./models/block.glb",
   *     "air": "./models/air.glb"
   *   }
   * );
   *
   * // Option 2: With pre-loaded models (more efficient)
   * const tileLoader = new GLBTileLoader();
   * const modelData = await tileLoader.loadTileset([
   *   { id: "block", model: "./models/block.glb" },
   *   { id: "air", model: "./models/air.glb" }
   * ]);
   *
   * const tileset = await adjLoader.applyToModels(
   *   "./adjacency-config.glb",
   *   {
   *     "block": "./models/block.glb",
   *     "air": "./models/air.glb"
   *   },
   *   modelData
   * );
   * ```
   */
  async applyToModels(
    url: string,
    modelPathMap: { [tileId: string]: string },
    loadedModels?: Map<string, LoadedModelData>
  ): Promise<ModelTile3DConfig[]> {
    const { configs } = await this.load(url);

    // Note: loadedModels parameter is available for future optimization
    // Currently, the GLBTileLoader handles caching internally when you call loadTileset()
    // This parameter is here for API consistency and potential future use cases
    if (loadedModels) {
      // Models are already loaded and cached by GLBTileLoader
      // No additional processing needed here
    }

    // Build tileset with actual model paths
    const tileset: ModelTile3DConfig[] = configs.map((config) => {
      const modelPath = modelPathMap[config.id];

      if (!modelPath) {
        console.warn(
          `No model path provided for tile "${config.id}", using placeholder`
        );
      }

      return {
        ...config,
        model: modelPath || config.model,
      };
    });

    return tileset;
  }
}
