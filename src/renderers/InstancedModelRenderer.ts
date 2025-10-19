import * as THREE from "three";
import type { LoadedModelData } from "../loaders/GLBTileLoader";
import type { TileInstance, TileTransformOverride } from "../types";
/**
 * Renders collapsed WFC grid using instanced meshes for memory efficiency
 */
export class InstancedModelRenderer {
  private scene: THREE.Scene;
  private instancedMeshes: Map<string, THREE.InstancedMesh>;
  private instanceData: Map<string, TileInstance[]>; // Store instances per tile
  private modelData: Map<string, LoadedModelData> | null = null;
  private cellSize: number;
  private transformOverrides: Map<string, TileTransformOverride>; // Per-tile transform overrides

  constructor(scene: THREE.Scene, cellSize: number = 1) {
    this.scene = scene;
    this.cellSize = cellSize;
    this.instancedMeshes = new Map();
    this.instanceData = new Map();
    this.transformOverrides = new Map();
  }

  updateTileset(modelData: Map<string, LoadedModelData>): void {
    this.modelData = modelData;
  }

  /**
   * Render the collapsed WFC grid using instanced meshes
   */
  render(grid: string[][][]): void {
    // Clear existing instances
    this.clear();

    // Count instances per tile type
    const instanceCounts = new Map<string, TileInstance[]>();

    const width = grid.length;
    const height = grid[0]?.length || 0;
    const depth = grid[0]?.[0]?.length || 0;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const tileId = grid[x][y][z];

          if (!tileId) continue;

          if (!instanceCounts.has(tileId)) {
            instanceCounts.set(tileId, []);
          }

          instanceCounts.get(tileId)!.push({ tileId, x, y, z });
        }
      }
    }

    // Store instance data
    this.instanceData = instanceCounts;

    if (!this.modelData) throw new Error("No model data found");

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

      this.updateInstanceMatrices(instancedMesh, tileId, instances);

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
    this.instanceData.clear();
  }

  /**
   * Get statistics about rendered instances
   */
  getStats(): { tileTypes: number; totalInstances: number } {
    let totalInstances = 0;
    for (const mesh of this.instancedMeshes.values())
      totalInstances += mesh.count;

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
   * Update the cell size and recalculate all instance positions
   */
  setCellSize(cellSize: number): void {
    if (cellSize === this.cellSize) return;

    this.cellSize = cellSize;

    // Update all existing instances with new cell size
    for (const [tileId, instances] of this.instanceData.entries()) {
      const instancedMesh = this.instancedMeshes.get(tileId);
      if (instancedMesh) {
        this.updateInstanceMatrices(instancedMesh, tileId, instances);
        instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Get the current rendered grid
   */
  getCurrentGrid(): string[][][] | null {
    // Would need to track the grid during render() to implement this
    // For now, return null to indicate we need a full re-render
    return null;
  }

  /**
   * Add a single tile instance in real-time (for incremental rendering during generation)
   */
  addTileInstance(tileId: string, x: number, y: number, z: number): void {
    // Get or create instance data array for this tile type
    if (!this.instanceData.has(tileId)) {
      this.instanceData.set(tileId, []);
    }

    const instances = this.instanceData.get(tileId)!;
    instances.push({ tileId, x, y, z });

    // Get or create instanced mesh
    let instancedMesh = this.instancedMeshes.get(tileId);

    if (!this.modelData) throw new Error("No model data found");

    if (!instancedMesh) {
      // Create new instanced mesh with initial capacity
      const modelData = this.modelData.get(tileId);
      if (!modelData) {
        console.warn(`No model data found for tile: ${tileId}`);
        return;
      }

      // Start with reasonable capacity (will grow as needed)
      const initialCapacity = 100;
      instancedMesh = new THREE.InstancedMesh(
        modelData.geometry,
        modelData.material,
        initialCapacity
      );

      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      this.instancedMeshes.set(tileId, instancedMesh);
      this.scene.add(instancedMesh);
    }

    // Check if we need to grow the instanced mesh
    const needsGrow = instances.length > instancedMesh.count;
    if (needsGrow) {
      // Need to create a larger instanced mesh
      const oldMesh = instancedMesh;
      const newCapacity = Math.max(instancedMesh.count * 2, instances.length);

      const modelData = this.modelData.get(tileId)!;
      instancedMesh = new THREE.InstancedMesh(
        modelData.geometry,
        modelData.material,
        newCapacity
      );

      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      // Remove old mesh and add new one
      this.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
      this.scene.add(instancedMesh);
      this.instancedMeshes.set(tileId, instancedMesh);
    }

    // If we grew the mesh, we need to re-render all instances
    // Otherwise just update the newest one
    const startIndex = needsGrow ? 0 : instances.length - 1;
    const endIndex = instances.length;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    const modelData = this.modelData.get(tileId)!;
    let tilePosition = modelData.position || new THREE.Vector3(0, 0, 0);
    let tileRotation = modelData.rotation || new THREE.Euler(0, 0, 0);
    let tileScale = modelData.scale || new THREE.Vector3(1, 1, 1);

    // Apply overrides if they exist
    const override = this.transformOverrides.get(tileId);
    if (override) {
      if (override.position) tilePosition = override.position;
      if (override.rotation) tileRotation = override.rotation;
      if (override.scale) tileScale = override.scale;
    }

    // Update matrices for all instances (if grew) or just the newest one
    for (let i = startIndex; i < endIndex; i++) {
      const instance = instances[i];

      position.set(
        instance.x * this.cellSize + tilePosition.x,
        instance.y * this.cellSize + tilePosition.y,
        instance.z * this.cellSize + tilePosition.z
      );

      rotation.setFromEuler(tileRotation);
      scale.copy(tileScale);

      matrix.compose(position, rotation, scale);
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;

    // Update visible instance count
    instancedMesh.count = instances.length;
  }

  /**
   * Update transform override for a specific tile type
   * This will immediately update all instances of that tile
   */
  updateTileTransform(
    tileId: string,
    transform: Partial<TileTransformOverride>
  ): void {
    // Get or create transform override
    if (!this.transformOverrides.has(tileId)) {
      this.transformOverrides.set(tileId, {});
    }

    const override = this.transformOverrides.get(tileId)!;

    // Update override
    if (transform.position) {
      override.position = transform.position.clone();
    }
    if (transform.rotation) {
      override.rotation = transform.rotation.clone();
    }
    if (transform.scale) {
      override.scale = transform.scale.clone();
    }

    // Get the instanced mesh and instance data
    const instancedMesh = this.instancedMeshes.get(tileId);
    const instances = this.instanceData.get(tileId);

    if (instancedMesh && instances) {
      // Recompute all matrices for this tile type
      this.updateInstanceMatrices(instancedMesh, tileId, instances);
      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Clear all transform overrides
   */
  clearTransformOverrides(): void {
    this.transformOverrides.clear();

    // Re-render all tiles with default transforms
    for (const [tileId, instances] of this.instanceData.entries()) {
      const instancedMesh = this.instancedMeshes.get(tileId);
      if (instancedMesh && instances) {
        this.updateInstanceMatrices(instancedMesh, tileId, instances);
        instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Helper to update instance matrices for a tile type
   */
  private updateInstanceMatrices(
    instancedMesh: THREE.InstancedMesh,
    tileId: string,
    instances: TileInstance[]
  ): void {
    if (!this.modelData) throw new Error("No model data found");
    const modelData = this.modelData.get(tileId);
    if (!modelData) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    // Get base tile-level transforms from modelData
    let tilePosition = modelData.position || new THREE.Vector3(0, 0, 0);
    let tileRotation = modelData.rotation || new THREE.Euler(0, 0, 0);
    let tileScale = modelData.scale || new THREE.Vector3(1, 1, 1);

    // Apply overrides if they exist
    const override = this.transformOverrides.get(tileId);
    if (override) {
      if (override.position) tilePosition = override.position;
      if (override.rotation) tileRotation = override.rotation;
      if (override.scale) tileScale = override.scale;
    }

    instances.forEach((instance, index) => {
      // Grid position + tile-level position offset
      position.set(
        instance.x * this.cellSize + tilePosition.x,
        instance.y * this.cellSize + tilePosition.y,
        instance.z * this.cellSize + tilePosition.z
      );

      // Combine tile-level rotation with per-instance rotation
      if (instance.rotation !== undefined) {
        // Per-instance rotation (Y-axis)
        const instanceQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          instance.rotation
        );
        // Tile-level rotation
        const tileQuat = new THREE.Quaternion().setFromEuler(tileRotation);
        // Combine: tile rotation first, then instance rotation
        rotation.multiplyQuaternions(instanceQuat, tileQuat);
      } else {
        // Just tile-level rotation
        rotation.setFromEuler(tileRotation);
      }

      // Apply tile-level scale
      scale.copy(tileScale);

      matrix.compose(position, rotation, scale);
      instancedMesh.setMatrixAt(index, matrix);
    });
  }
}
