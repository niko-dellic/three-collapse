import * as THREE from "three";
import type { LoadedModelData } from "../loaders/GLBTileLoader";

/**
 * Instance data for a single tile placement
 */
export interface TileInstance {
  tileId: string;
  x: number;
  y: number;
  z: number;
  rotation?: number; // Rotation in radians (for future use)
}

/**
 * Renders collapsed WFC grid using instanced meshes for memory efficiency
 */
export class InstancedModelRenderer {
  private scene: THREE.Scene;
  private instancedMeshes: Map<string, THREE.InstancedMesh>;
  private modelData: Map<string, LoadedModelData>;
  private cellSize: number;

  constructor(
    scene: THREE.Scene,
    modelData: Map<string, LoadedModelData>,
    cellSize: number = 1
  ) {
    this.scene = scene;
    this.modelData = modelData;
    this.cellSize = cellSize;
    this.instancedMeshes = new Map();
  }

  /**
   * Render the collapsed WFC grid using instanced meshes
   */
  render(collapsedGrid: string[][][]): void {
    // Clear existing instances
    this.clear();

    // Count instances per tile type
    const instanceCounts = new Map<string, TileInstance[]>();

    const width = collapsedGrid.length;
    const height = collapsedGrid[0]?.length || 0;
    const depth = collapsedGrid[0]?.[0]?.length || 0;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const tileId = collapsedGrid[x][y][z];

          if (!tileId) continue;

          if (!instanceCounts.has(tileId)) {
            instanceCounts.set(tileId, []);
          }

          instanceCounts.get(tileId)!.push({ tileId, x, y, z });
        }
      }
    }

    // Create instanced meshes for each tile type
    for (const [tileId, instances] of instanceCounts.entries()) {
      const modelData = this.modelData.get(tileId);
      if (!modelData) {
        console.warn(`No model data found for tile: ${tileId}`);
        continue;
      }

      const count = instances.length;
      const instancedMesh = new THREE.InstancedMesh(
        modelData.geometry,
        modelData.material,
        count
      );

      // Set transformation matrices for each instance
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);

      instances.forEach((instance, index) => {
        position.set(
          instance.x * this.cellSize,
          instance.y * this.cellSize,
          instance.z * this.cellSize
        );

        // Apply rotation if specified (for future use)
        if (instance.rotation !== undefined) {
          rotation.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            instance.rotation
          );
        } else {
          rotation.identity();
        }

        matrix.compose(position, rotation, scale);
        instancedMesh.setMatrixAt(index, matrix);
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      this.instancedMeshes.set(tileId, instancedMesh);
      this.scene.add(instancedMesh);
    }
  }

  /**
   * Update position offset for the entire group
   */
  setOffset(offsetX: number, offsetY: number, offsetZ: number): void {
    for (const mesh of this.instancedMeshes.values()) {
      mesh.position.set(offsetX, offsetY, offsetZ);
    }
  }

  /**
   * Clear all instanced meshes from the scene
   */
  clear(): void {
    for (const mesh of this.instancedMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();

      // Dispose materials
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.instancedMeshes.clear();
  }

  /**
   * Get statistics about rendered instances
   */
  getStats(): { tileTypes: number; totalInstances: number } {
    let totalInstances = 0;
    for (const mesh of this.instancedMeshes.values()) {
      totalInstances += mesh.count;
    }

    return {
      tileTypes: this.instancedMeshes.size,
      totalInstances,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
  }

  /**
   * Update the renderer with a new grid, preserving existing instances where possible
   */
  updateGrid(collapsedGrid: string[][][]): void {
    // For now, use simple re-render approach
    // Future optimization: track changes and update only modified instances
    this.render(collapsedGrid);
  }

  /**
   * Get the current rendered grid
   */
  getCurrentGrid(): string[][][] | null {
    // Would need to track the grid during render() to implement this
    // For now, return null to indicate we need a full re-render
    return null;
  }
}
