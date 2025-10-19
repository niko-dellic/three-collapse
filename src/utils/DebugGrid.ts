import * as THREE from "three";

/**
 * Debug visualization helper for WFC grids
 */
export class DebugGrid {
  private scene: THREE.Scene;
  private gridGroup: THREE.Group;
  private cellSize: number;
  private visible: boolean = true;
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private currentDepth: number = 0;
  private currentMinX: number = 0;
  private currentMinY: number = 0;
  private currentMinZ: number = 0;
  private color: number;
  private highlightMesh: THREE.Mesh | null = null;
  private highlightVisible: boolean = false;
  private previewMeshes: THREE.LineSegments[] = [];
  private previewVisible: boolean = false;

  // Instanced mesh for grid cells with wireframe material
  private instancedGridMesh: THREE.InstancedMesh | null = null;
  private instancedPreviewMesh: THREE.InstancedMesh | null = null;
  private boundingBox: THREE.LineSegments | null = null;

  // Store cell coordinates for highlight and preview (grid space, not world space)
  private highlightedCell: { x: number; y: number; z: number } | null = null;
  private previewCells: Array<[number, number, number]> = [];

  constructor(
    scene: THREE.Scene,
    cellSize: number = 1,
    color: number = 0x00ff00
  ) {
    this.scene = scene;
    this.cellSize = cellSize;
    this.color = color;
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = "debug_grid";
    this.gridGroup.visible = this.visible; // Sync with visible property
    this.scene.add(this.gridGroup);

    // Create highlight mesh
    this.createHighlightMesh();
  }

  /**
   * Update the debug grid to match the current WFC grid dimensions and bounds
   */
  updateGrid(
    width: number,
    height: number,
    depth: number,
    minX: number = 0,
    minY: number = 0,
    minZ: number = 0
  ): void {
    // Clear existing grid if dimensions or bounds changed
    if (
      width !== this.currentWidth ||
      height !== this.currentHeight ||
      depth !== this.currentDepth ||
      minX !== this.currentMinX ||
      minY !== this.currentMinY ||
      minZ !== this.currentMinZ
    ) {
      this.clear();
      this.createWireframeGrid(width, height, depth, minX, minY, minZ);
      this.currentWidth = width;
      this.currentHeight = height;
      this.currentDepth = depth;
      this.currentMinX = minX;
      this.currentMinY = minY;
      this.currentMinZ = minZ;
    }
  }

  /**
   * Create a wireframe grid showing all cell boundaries using instanced mesh with wireframe material
   */
  private createWireframeGrid(
    width: number,
    height: number,
    depth: number,
    minX: number = 0,
    minY: number = 0,
    minZ: number = 0
  ): void {
    const cellCount = width * height * depth;

    // Create base geometry for a single cell
    const boxGeometry = new THREE.BoxGeometry(
      this.cellSize,
      this.cellSize,
      this.cellSize
    );

    // Create wireframe material
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    });

    // Create instanced mesh for all cells
    this.instancedGridMesh = new THREE.InstancedMesh(
      boxGeometry,
      material,
      cellCount
    );
    this.instancedGridMesh.name = "instanced_grid";

    // Set matrix for each instance
    const matrix = new THREE.Matrix4();
    let instanceIndex = 0;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          // Position using world coordinates (including min bounds)
          matrix.setPosition(
            (x + minX) * this.cellSize,
            (y + minY) * this.cellSize,
            (z + minZ) * this.cellSize
          );

          this.instancedGridMesh.setMatrixAt(instanceIndex, matrix);
          instanceIndex++;
        }
      }
    }

    // Update instance matrix
    this.instancedGridMesh.instanceMatrix.needsUpdate = true;
    this.gridGroup.add(this.instancedGridMesh);

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
    this.boundingBox = new THREE.LineSegments(boundingEdges, boundingMaterial);

    // Position bounding box at center of grid (accounting for min bounds)
    const centerX = (minX + minX + width - 1) / 2;
    const centerY = (minY + minY + height - 1) / 2;
    const centerZ = (minZ + minZ + depth - 1) / 2;

    this.boundingBox.position.set(
      centerX * this.cellSize,
      centerY * this.cellSize,
      centerZ * this.cellSize
    );

    this.gridGroup.add(this.boundingBox);
    boundingGeometry.dispose();
    boundingEdges.dispose();
  }

  /**
   * Update cell size and regenerate grid if needed
   */
  setCellSize(cellSize: number): void {
    if (cellSize !== this.cellSize) {
      this.cellSize = cellSize;

      // Regenerate grid if it's already been created
      if (
        this.currentWidth > 0 ||
        this.currentHeight > 0 ||
        this.currentDepth > 0
      ) {
        this.clear();
        this.createWireframeGrid(
          this.currentWidth,
          this.currentHeight,
          this.currentDepth,
          this.currentMinX,
          this.currentMinY,
          this.currentMinZ
        );
      }

      // Recreate highlight mesh with new cell size
      if (this.highlightMesh) {
        this.scene.remove(this.highlightMesh);
        this.highlightMesh.geometry.dispose();
        if (this.highlightMesh.material instanceof THREE.Material) {
          this.highlightMesh.material.dispose();
        }
        this.createHighlightMesh();

        // Reposition based on stored cell coordinates
        if (this.highlightedCell) {
          this.highlightMesh.position.set(
            this.highlightedCell.x * this.cellSize,
            this.highlightedCell.y * this.cellSize,
            this.highlightedCell.z * this.cellSize
          );
        }
        this.updateHighlightVisibility();
      }

      // Recreate preview expansion with new cell size
      if (this.previewCells.length > 0) {
        const cellsToPreview = [...this.previewCells];
        this.showExpansionPreview(cellsToPreview);
      }
    }
  }

  /**
   * Create the cell highlight mesh
   */
  private createHighlightMesh(): void {
    const geometry = new THREE.BoxGeometry(
      this.cellSize * 0.95,
      this.cellSize * 0.95,
      this.cellSize * 0.95
    );
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    this.highlightMesh = new THREE.Mesh(geometry, material);
    this.highlightMesh.name = "cell_highlight";
    this.highlightMesh.visible = false;

    // Add edges for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xff6600,
      linewidth: 3,
    });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    this.highlightMesh.add(edgeLines);

    this.scene.add(this.highlightMesh);
  }

  /**
   * Highlight a specific cell
   */
  highlightCell(x: number, y: number, z: number): void {
    if (!this.highlightMesh) return;

    // Store cell coordinates
    this.highlightedCell = { x, y, z };

    this.highlightMesh.position.set(
      x * this.cellSize,
      y * this.cellSize,
      z * this.cellSize
    );

    this.highlightVisible = true;
    this.updateHighlightVisibility();
  }

  /**
   * Hide the cell highlight
   */
  hideHighlight(): void {
    this.highlightedCell = null;
    this.highlightVisible = false;
    this.updateHighlightVisibility();
  }

  /**
   * Show expansion preview (purple wireframe boxes for cells that will be added)
   * Uses instanced mesh with wireframe material for better performance
   */
  showExpansionPreview(cells: Array<[number, number, number]>): void {
    // Clear existing preview
    this.clearExpansionPreview();

    if (cells.length === 0) return;

    // Store preview cells for cell size updates
    this.previewCells = [...cells];

    // Create base geometry for a single cell
    const boxGeometry = new THREE.BoxGeometry(
      this.cellSize,
      this.cellSize,
      this.cellSize
    );

    // Create purple wireframe material
    const material = new THREE.MeshBasicMaterial({
      color: 0x9933ff, // Purple
      transparent: true,
      opacity: 0.8,
      wireframe: true,
    });

    // Create instanced mesh for all preview cells
    this.instancedPreviewMesh = new THREE.InstancedMesh(
      boxGeometry,
      material,
      cells.length
    );
    this.instancedPreviewMesh.name = "instanced_preview";

    // Set matrix for each instance
    const matrix = new THREE.Matrix4();
    cells.forEach(([x, y, z], index) => {
      matrix.setPosition(
        x * this.cellSize,
        y * this.cellSize,
        z * this.cellSize
      );
      this.instancedPreviewMesh!.setMatrixAt(index, matrix);
    });

    // Update instance matrix
    this.instancedPreviewMesh.instanceMatrix.needsUpdate = true;
    this.instancedPreviewMesh.visible = this.visible;
    this.scene.add(this.instancedPreviewMesh);

    this.previewVisible = true;
  }

  /**
   * Clear expansion preview
   */
  clearExpansionPreview(): void {
    // Clean up old non-instanced preview meshes (for backwards compatibility)
    for (const wireframe of this.previewMeshes) {
      this.scene.remove(wireframe);
      wireframe.geometry.dispose();
      if (wireframe.material instanceof THREE.Material) {
        wireframe.material.dispose();
      }
    }
    this.previewMeshes = [];

    // Clean up instanced preview mesh
    if (this.instancedPreviewMesh) {
      this.scene.remove(this.instancedPreviewMesh);
      this.instancedPreviewMesh.geometry.dispose();
      if (this.instancedPreviewMesh.material instanceof THREE.Material) {
        this.instancedPreviewMesh.material.dispose();
      }
      this.instancedPreviewMesh = null;
    }

    // Clear stored preview cells
    this.previewCells = [];

    this.previewVisible = false;
  }

  /**
   * Update highlight visibility based on wireframe state
   */
  private updateHighlightVisibility(): void {
    if (this.highlightMesh) {
      this.highlightMesh.visible = this.visible && this.highlightVisible;
    }

    // Update preview visibility for old non-instanced meshes
    for (const mesh of this.previewMeshes) {
      mesh.visible = this.visible && this.previewVisible;
    }

    // Update preview visibility for instanced mesh
    if (this.instancedPreviewMesh) {
      this.instancedPreviewMesh.visible = this.visible && this.previewVisible;
    }
  }

  /**
   * Toggle wireframe visibility
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.gridGroup.visible = visible;
    this.updateHighlightVisibility();
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
    // Clear instanced grid mesh
    if (this.instancedGridMesh) {
      this.gridGroup.remove(this.instancedGridMesh);
      this.instancedGridMesh.geometry.dispose();
      if (this.instancedGridMesh.material instanceof THREE.Material) {
        this.instancedGridMesh.material.dispose();
      }
      this.instancedGridMesh = null;
    }

    // Clear bounding box
    if (this.boundingBox) {
      this.gridGroup.remove(this.boundingBox);
      this.boundingBox.geometry.dispose();
      if (this.boundingBox.material instanceof THREE.Material) {
        this.boundingBox.material.dispose();
      }
      this.boundingBox = null;
    }

    // Clean up any remaining children (for backwards compatibility)
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);

      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      } else if (child instanceof THREE.InstancedMesh) {
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

    // Clean up highlight mesh
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      if (this.highlightMesh.material instanceof THREE.Material) {
        this.highlightMesh.material.dispose();
      }
      // Dispose of edge lines
      this.highlightMesh.children.forEach((child) => {
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      this.highlightMesh = null;
    }

    // Clean up preview meshes
    this.clearExpansionPreview();
  }

  /**
   * Update the grid with additional visual features
   */
  setWireframeColor(color: number, opacity: number = 0.3): void {
    // Update instanced grid mesh
    if (
      this.instancedGridMesh &&
      this.instancedGridMesh.material instanceof THREE.MeshBasicMaterial
    ) {
      this.instancedGridMesh.material.color.setHex(color);
      this.instancedGridMesh.material.opacity = opacity;
    }

    // Update old non-instanced meshes (for backwards compatibility)
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
