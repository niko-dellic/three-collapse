import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  ModelTile3DConfig,
  TileConnectors,
  DirectionalExclusion,
} from "../wfc3d";

export interface GLBAdjacencyData {
  configs: ModelTile3DConfig[];
  scene: THREE.Group;
}

export interface LoadedTileData {
  id: string;
  object: THREE.Object3D;
  weight: number;
  connectors: TileConnectors;
  exclusions: DirectionalExclusion[];
}

/**
 * Helper class to load connector and adjacency data from GLB files
 *
 * This loader can import tile configurations that were exported from the connector
 * builder tool, which stores connectors, exclusions, and computed adjacency in the GLB file's userData.
 *
 * @example
 * ```typescript
 * import { GLBAdjacencyLoader } from "three-collapse";
 *
 * const loader = new GLBAdjacencyLoader();
 *
 * // Load from URL
 * const { configs, scene } = await loader.load("./connector-config.glb");
 *
 * // Or merge with existing tileset
 * const updatedTileset = await loader.loadAndMerge(
 *   "./connector-config.glb",
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
   * Load a GLB file and extract connector configuration
   *
   * @param url - Path to the GLB file
   * @returns Promise resolving to connector data and scene
   * @throws Error if no connector data is found in the GLB file
   */
  async load(url: string): Promise<GLBAdjacencyData> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const configs = this.extractConfigsFromScene(gltf.scene);

          if (configs.length === 0) {
            reject(new Error("No connector data found in GLB file meshes"));
            return;
          }

          resolve({
            configs,
            scene: gltf.scene,
          });
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Extract ModelTile3DConfig from a loaded scene by reading mesh userData
   */
  private extractConfigsFromScene(scene: THREE.Group): ModelTile3DConfig[] {
    const configs: ModelTile3DConfig[] = [];

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.connectors) {
        const config: ModelTile3DConfig = {
          id: child.userData.tileId || child.name || `tile_${configs.length}`,
          weight: child.userData.weight || 1,
          model: child, // Use the mesh object directly
          connectors: child.userData.connectors as TileConnectors,
          exclusions:
            (child.userData.exclusions as DirectionalExclusion[]) || [],
        };

        configs.push(config);
      }
    });

    return configs;
  }

  /**
   * Load a GLB file and merge its configs with an existing tileset
   *
   * @param url - Path to the GLB file
   * @param existingTileset - Existing tile configurations
   * @returns Promise resolving to merged tileset
   */
  async loadAndMerge(
    url: string,
    existingTileset: ModelTile3DConfig[]
  ): Promise<ModelTile3DConfig[]> {
    const { configs } = await this.load(url);
    return this.mergeTilesets(existingTileset, configs);
  }

  /**
   * Parse GLB data from ArrayBuffer
   *
   * @param arrayBuffer - GLB file data
   * @returns Promise resolving to connector data and scene
   */
  async parseFromBuffer(arrayBuffer: ArrayBuffer): Promise<GLBAdjacencyData> {
    return new Promise((resolve, reject) => {
      this.loader.parse(
        arrayBuffer,
        "",
        (gltf) => {
          const configs = this.extractConfigsFromScene(gltf.scene);

          if (configs.length === 0) {
            reject(new Error("No connector data found in GLB file meshes"));
            return;
          }

          resolve({
            configs,
            scene: gltf.scene,
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Merge two tilesets, with the new tileset taking precedence for duplicates
   *
   * @param existingTileset - Current tileset
   * @param newTileset - New tileset to merge in
   * @returns Merged tileset
   */
  mergeTilesets(
    existingTileset: ModelTile3DConfig[],
    newTileset: ModelTile3DConfig[]
  ): ModelTile3DConfig[] {
    const merged = new Map<string, ModelTile3DConfig>();

    // Add existing tiles
    for (const tile of existingTileset) {
      merged.set(tile.id, tile);
    }

    // Override with new tiles
    for (const tile of newTileset) {
      merged.set(tile.id, tile);
    }

    return Array.from(merged.values());
  }

  /**
   * Extract loaded models with their connector data
   *
   * @param gltf - Loaded GLTF object
   * @returns Array of loaded models with their data
   */
  extractLoadedModels(gltf: any): LoadedTileData[] {
    const models: LoadedTileData[] = [];

    gltf.scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.userData.connectors) {
        models.push({
          id: child.userData.tileId || child.name,
          object: child,
          weight: child.userData.weight || 1,
          connectors: child.userData.connectors,
          exclusions: child.userData.exclusions || [],
        });
      }
    });

    return models;
  }
}
