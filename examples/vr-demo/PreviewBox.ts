import * as THREE from "three";

export type PreviewMode = "create" | "delete" | "hidden";

/**
 * Visual preview system for expansion/deletion regions in VR
 */
export class PreviewBox {
  private box: THREE.LineSegments;
  private cellSize: number;
  private mode: PreviewMode = "hidden";

  // Size parameters
  private sizeX: number = 3;
  private sizeY: number = 3;
  private sizeZ: number = 3;

  // Materials for different modes
  private createMaterial: THREE.LineBasicMaterial;
  private deleteMaterial: THREE.LineBasicMaterial;

  constructor(scene: THREE.Scene, cellSize: number = 2) {
    this.cellSize = cellSize;

    // Create materials
    this.createMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
    });

    this.deleteMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
    });

    // Create box geometry
    const geometry = this.createBoxGeometry();
    this.box = new THREE.LineSegments(geometry, this.createMaterial);
    this.box.visible = false;

    scene.add(this.box);
  }

  /**
   * Create wireframe box geometry
   */
  private createBoxGeometry(): THREE.EdgesGeometry {
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    return new THREE.EdgesGeometry(boxGeometry);
  }

  /**
   * Update preview box position based on cell coordinates
   */
  updatePosition(cellX: number, cellY: number, cellZ: number): void {
    // Calculate the center position of the expansion region
    const centerX = cellX * this.cellSize;
    const centerY = cellY * this.cellSize + (this.sizeY * this.cellSize) / 2;
    const centerZ = cellZ * this.cellSize;

    this.box.position.set(centerX, centerY, centerZ);

    // Update scale based on size parameters
    this.box.scale.set(
      this.sizeX * this.cellSize,
      this.sizeY * this.cellSize,
      this.sizeZ * this.cellSize
    );
  }

  /**
   * Set preview mode (create, delete, or hidden)
   */
  setMode(mode: PreviewMode): void {
    this.mode = mode;

    if (mode === "hidden") {
      this.box.visible = false;
    } else {
      this.box.visible = true;
      this.box.material =
        mode === "create" ? this.createMaterial : this.deleteMaterial;
    }
  }

  /**
   * Get current mode
   */
  getMode(): PreviewMode {
    return this.mode;
  }

  /**
   * Set size parameters
   */
  setSize(x: number, y: number, z: number): void {
    this.sizeX = Math.max(1, Math.min(10, x));
    this.sizeY = Math.max(1, Math.min(10, y));
    this.sizeZ = Math.max(1, Math.min(10, z));
  }

  /**
   * Adjust size by delta
   */
  adjustSize(axis: "x" | "y" | "z", delta: number): void {
    if (axis === "x") {
      this.sizeX = Math.max(1, Math.min(10, this.sizeX + delta));
    } else if (axis === "y") {
      this.sizeY = Math.max(1, Math.min(10, this.sizeY + delta));
    } else {
      this.sizeZ = Math.max(1, Math.min(10, this.sizeZ + delta));
    }
  }

  /**
   * Get current size parameters
   */
  getSize(): { x: number; y: number; z: number } {
    return { x: this.sizeX, y: this.sizeY, z: this.sizeZ };
  }

  /**
   * Show preview at position
   */
  show(): void {
    if (this.mode !== "hidden") {
      this.box.visible = true;
    }
  }

  /**
   * Hide preview
   */
  hide(): void {
    this.box.visible = false;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.box.geometry.dispose();
    this.createMaterial.dispose();
    this.deleteMaterial.dispose();
  }
}
