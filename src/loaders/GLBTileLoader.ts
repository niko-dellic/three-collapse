import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelTile3DConfig } from "../wfc3d";

/**
 * Loaded model data optimized for instancing
 */
export interface LoadedModelData {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  boundingBox: THREE.Box3;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
}

/**
 * GLB Tile Loader with caching for memory efficiency
 */
export class GLBTileLoader {
  private loader: GLTFLoader;
  private cache: Map<string, Promise<LoadedModelData>>;

  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  /**
   * Load a single GLB model
   */
  async loadModel(filepath: string): Promise<LoadedModelData> {
    // Check cache first
    if (this.cache.has(filepath)) {
      return this.cache.get(filepath)!;
    }

    // Create loading promise
    const loadPromise = new Promise<LoadedModelData>((resolve, reject) => {
      this.loader.load(
        filepath,
        (gltf) => {
          // Extract geometry and material from the first mesh found
          let extractedGeometry: THREE.BufferGeometry | null = null;
          let extractedMaterial: THREE.Material | THREE.Material[] | null =
            null;

          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh && extractedGeometry === null) {
              extractedGeometry = child.geometry;
              extractedMaterial = child.material;
            }
          });

          if (extractedGeometry === null || extractedMaterial === null) {
            reject(new Error(`No mesh found in GLB file: ${filepath}`));
            return;
          }

          // Type narrowing didn't work, so we assert non-null
          const geometry = extractedGeometry as THREE.BufferGeometry;
          const material = extractedMaterial as
            | THREE.Material
            | THREE.Material[];

          // Calculate bounding box
          geometry.computeBoundingBox();
          const boundingBox = geometry.boundingBox || new THREE.Box3();

          resolve({
            geometry: geometry.clone(),
            material: Array.isArray(material)
              ? material.map((m: THREE.Material) => m.clone())
              : material.clone(),
            boundingBox: boundingBox.clone(),
          });
        },
        undefined,
        (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          reject(
            new Error(`Failed to load GLB file ${filepath}: ${errorMessage}`)
          );
        }
      );
    });

    // Cache the promise
    this.cache.set(filepath, loadPromise);
    return loadPromise;
  }

  /**
   * Create model data from a geometry function
   */
  createModelDataFromGeometry(
    geometryFn: () => THREE.Object3D
  ): LoadedModelData {
    const object = geometryFn();

    // Extract geometry and material from the object
    let extractedGeometry: THREE.BufferGeometry | null = null;
    let extractedMaterial: THREE.Material | THREE.Material[] | null = null;

    if (object instanceof THREE.Mesh) {
      extractedGeometry = object.geometry;
      extractedMaterial = object.material;
    } else {
      // Traverse to find the first mesh
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && extractedGeometry === null) {
          extractedGeometry = child.geometry;
          extractedMaterial = child.material;
        }
      });
    }

    if (extractedGeometry === null || extractedMaterial === null) {
      throw new Error("No mesh found in geometry function result");
    }

    // Calculate bounding box
    extractedGeometry.computeBoundingBox();
    const boundingBox = extractedGeometry.boundingBox || new THREE.Box3();

    return {
      geometry: extractedGeometry.clone(),
      material: Array.isArray(extractedMaterial)
        ? extractedMaterial.map((m: THREE.Material) => m.clone())
        : extractedMaterial.clone(),
      boundingBox: boundingBox.clone(),
    };
  }

  /**
   * Load all models from a tileset configuration
   * Supports both GLB file paths (string) and geometry functions
   * Supports material override, position, rotation, and scale per tile
   */
  async loadTileset(
    tileConfigs: ModelTile3DConfig[]
  ): Promise<Map<string, LoadedModelData>> {
    const modelMap = new Map<string, LoadedModelData>();
    const loadPromises: Promise<void>[] = [];

    for (const config of tileConfigs) {
      if (typeof config.model === "string") {
        // Load from GLB file
        const promise = this.loadModel(config.model).then((modelData) => {
          const finalModelData = this.applyOverrides(modelData, config);
          modelMap.set(config.id, finalModelData);
        });
        loadPromises.push(promise);
      } else if (typeof config.model === "function") {
        // Create from geometry function
        try {
          const modelData = this.createModelDataFromGeometry(config.model);
          const finalModelData = this.applyOverrides(modelData, config);
          modelMap.set(config.id, finalModelData);
        } catch (error) {
          console.error(
            `Failed to create geometry for tile ${config.id}:`,
            error
          );
          throw error;
        }
      }
    }

    await Promise.all(loadPromises);
    return modelMap;
  }

  /**
   * Apply material, position, rotation, and scale overrides to model data
   */
  private applyOverrides(
    modelData: LoadedModelData,
    config: ModelTile3DConfig
  ): LoadedModelData {
    const result = { ...modelData };

    // Apply material override
    if (config.material) {
      result.material = Array.isArray(config.material)
        ? config.material.map((m) => m.clone())
        : config.material.clone();
    }

    // Apply position override
    if (config.position) {
      if (config.position instanceof THREE.Vector3) {
        result.position = config.position.clone();
      } else {
        result.position = new THREE.Vector3(
          config.position.x ?? 0,
          config.position.y ?? 0,
          config.position.z ?? 0
        );
      }
    }

    // Apply rotation override
    if (config.rotation) {
      if (config.rotation instanceof THREE.Euler) {
        result.rotation = config.rotation.clone();
      } else {
        result.rotation = new THREE.Euler(
          config.rotation.x || 0,
          config.rotation.y || 0,
          config.rotation.z || 0
        );
      }
    }

    // Apply scale override
    if (config.scale !== undefined) {
      if (config.scale instanceof THREE.Vector3) {
        result.scale = config.scale.clone();
      } else if (typeof config.scale === "number") {
        result.scale = new THREE.Vector3(
          config.scale,
          config.scale,
          config.scale
        );
      } else {
        result.scale = new THREE.Vector3(
          config.scale.x ?? 1,
          config.scale.y ?? 1,
          config.scale.z ?? 1
        );
      }
    }

    return result;
  }

  /**
   * Clear the cache and dispose of loaded resources
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
