import * as THREE from "three";

/**
 * Debug visualization helper for WFC grids
 */
export class DebugGrid {
  private scene: THREE.Scene;
  private gridGroup: THREE.Group;
  private cellSize: number;
  private visible: boolean = false;
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private currentDepth: number = 0;

  constructor(scene: THREE.Scene, cellSize: number = 1) {
    this.scene = scene;
    this.cellSize = cellSize;
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = "DebugGrid";
    this.gridGroup.visible = false;
    this.scene.add(this.gridGroup);
  }

  /**
   * Update the debug grid to match the current WFC grid dimensions
   */
  updateGrid(width: number, height: number, depth: number): void {
    // Clear existing grid if dimensions changed
    if (
      width !== this.currentWidth ||
      height !== this.currentHeight ||
      depth !== this.currentDepth
    ) {
      this.clear();
      this.createWireframeGrid(width, height, depth);
      this.currentWidth = width;
      this.currentHeight = height;
      this.currentDepth = depth;
    }
  }

  /**
   * Create a wireframe grid showing all cell boundaries
   */
  private createWireframeGrid(
    width: number,
    height: number,
    depth: number
  ): void {
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      linewidth: 1,
    });

    // Create cell wireframes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const geometry = new THREE.BoxGeometry(
            this.cellSize,
            this.cellSize,
            this.cellSize
          );
          const edges = new THREE.EdgesGeometry(geometry);
          const line = new THREE.LineSegments(edges, material);

          line.position.set(
            x * this.cellSize,
            y * this.cellSize,
            z * this.cellSize
          );

          this.gridGroup.add(line);
          geometry.dispose();
          edges.dispose();
        }
      }
    }

    // Create outer bounding box with thicker, more visible lines
    const boundingMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });

    const boundingGeometry = new THREE.BoxGeometry(
      width * this.cellSize,
      height * this.cellSize,
      depth * this.cellSize
    );
    const boundingEdges = new THREE.EdgesGeometry(boundingGeometry);
    const boundingLine = new THREE.LineSegments(
      boundingEdges,
      boundingMaterial
    );

    boundingLine.position.set(
      ((width - 1) * this.cellSize) / 2,
      ((height - 1) * this.cellSize) / 2,
      ((depth - 1) * this.cellSize) / 2
    );

    this.gridGroup.add(boundingLine);
    boundingGeometry.dispose();
    boundingEdges.dispose();
  }

  /**
   * Toggle wireframe visibility
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.gridGroup.visible = visible;
  }

  /**
   * Get current visibility state
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Toggle visibility on/off
   */
  toggle(): void {
    this.setVisible(!this.visible);
  }

  /**
   * Clear all debug geometry
   */
  clear(): void {
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);

      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }

  /**
   * Set position offset for the entire grid
   */
  setOffset(offsetX: number, offsetY: number, offsetZ: number): void {
    this.gridGroup.position.set(offsetX, offsetY, offsetZ);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
    this.scene.remove(this.gridGroup);
  }

  /**
   * Update the grid with additional visual features
   */
  setWireframeColor(color: number, opacity: number = 0.3): void {
    this.gridGroup.children.forEach((child) => {
      if (child instanceof THREE.LineSegments) {
        if (child.material instanceof THREE.LineBasicMaterial) {
          child.material.color.setHex(color);
          child.material.opacity = opacity;
        }
      }
    });
  }
}
