import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { PreviewBox } from "./PreviewBox";

export type ControllerMode = "edit" | "locomotion";

export interface ControllerCallbacks {
  onRightTrigger?: (
    cellX: number,
    cellY: number,
    cellZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ) => void;
  onLeftTrigger?: (
    cellX: number,
    cellY: number,
    cellZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ) => void;
  onTeleport?: (position: THREE.Vector3) => void;
}

/**
 * Manages VR controllers, input handling, and visual feedback
 */
export class VRControllerManager {
  private cellSize: number;

  // Controllers
  private controller1: THREE.Group; // Right controller
  private controller2: THREE.Group; // Left controller
  private controllerGrip1: THREE.Group;
  private controllerGrip2: THREE.Group;

  // Controller rays
  private rightRay: THREE.Line;
  private leftRay: THREE.Line;

  // Preview boxes
  private rightPreview: PreviewBox;
  private leftPreview: PreviewBox;

  // Mode
  private mode: ControllerMode = "edit";

  // Teleport system
  private teleportMarker: THREE.Mesh;
  private teleportCurve: THREE.Line;

  // Callbacks
  private callbacks: ControllerCallbacks;

  // Input state
  private isGenerating: boolean = false;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    _camera: THREE.Camera,
    cellSize: number = 2,
    callbacks: ControllerCallbacks = {}
  ) {
    this.cellSize = cellSize;
    this.callbacks = callbacks;

    // Initialize controllers
    this.controller1 = renderer.xr.getController(0);
    this.controller2 = renderer.xr.getController(1);
    this.controllerGrip1 = renderer.xr.getControllerGrip(0);
    this.controllerGrip2 = renderer.xr.getControllerGrip(1);

    // Setup controller models
    const controllerModelFactory = new XRControllerModelFactory();
    this.controllerGrip1.add(
      controllerModelFactory.createControllerModel(this.controllerGrip1)
    );
    this.controllerGrip2.add(
      controllerModelFactory.createControllerModel(this.controllerGrip2)
    );

    // Create controller rays
    this.rightRay = this.createControllerRay(0x00ff00);
    this.leftRay = this.createControllerRay(0xff0000);

    this.controller1.add(this.rightRay);
    this.controller2.add(this.leftRay);

    // Add controllers to scene
    scene.add(this.controller1);
    scene.add(this.controller2);
    scene.add(this.controllerGrip1);
    scene.add(this.controllerGrip2);

    // Create preview boxes
    this.rightPreview = new PreviewBox(scene, cellSize);
    this.leftPreview = new PreviewBox(scene, cellSize);

    // Create teleport marker
    this.teleportMarker = this.createTeleportMarker();
    this.teleportMarker.visible = false;
    scene.add(this.teleportMarker);

    // Create teleport curve
    this.teleportCurve = this.createTeleportCurve();
    this.teleportCurve.visible = false;
    scene.add(this.teleportCurve);

    // Setup event listeners
    this.setupEventListeners();

    // Set initial mode
    this.setMode("edit");
  }

  /**
   * Create a visual ray for the controller
   */
  private createControllerRay(color: number): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -2),
    ]);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geometry, material);
  }

  /**
   * Create teleport marker
   */
  private createTeleportMarker(): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(0.3, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.7,
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    return marker;
  }

  /**
   * Create teleport curve visualization
   */
  private createTeleportCurve(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geometry, material);
  }

  /**
   * Setup controller event listeners
   */
  private setupEventListeners(): void {
    // Right controller (Create)
    this.controller1.addEventListener("selectstart" as any, () => {
      if (this.mode === "edit" && !this.isGenerating) {
        this.handleRightTrigger();
      } else if (this.mode === "locomotion") {
        this.handleTeleport();
      }
    });

    // Left controller (Delete)
    this.controller2.addEventListener("selectstart" as any, () => {
      if (this.mode === "edit" && !this.isGenerating) {
        this.handleLeftTrigger();
      }
    });

    // Mode toggle (squeeze/grip buttons)
    this.controller1.addEventListener("squeezestart" as any, () => {
      this.toggleMode();
    });

    this.controller2.addEventListener("squeezestart" as any, () => {
      this.toggleMode();
    });
  }

  /**
   * Handle right trigger (create cells)
   */
  private handleRightTrigger(): void {
    const cell = this.getTargetCell(this.controller1);
    if (cell && this.callbacks.onRightTrigger) {
      const size = this.rightPreview.getSize();
      this.callbacks.onRightTrigger(
        cell.x,
        cell.y,
        cell.z,
        size.x,
        size.y,
        size.z
      );
    }
  }

  /**
   * Handle left trigger (delete cells)
   */
  private handleLeftTrigger(): void {
    const cell = this.getTargetCell(this.controller2);
    if (cell && this.callbacks.onLeftTrigger) {
      const size = this.leftPreview.getSize();
      this.callbacks.onLeftTrigger(
        cell.x,
        cell.y,
        cell.z,
        size.x,
        size.y,
        size.z
      );
    }
  }

  /**
   * Handle teleportation
   */
  private handleTeleport(): void {
    if (this.teleportMarker.visible && this.callbacks.onTeleport) {
      const targetPos = this.teleportMarker.position.clone();
      targetPos.y = 0; // Keep at ground level
      this.callbacks.onTeleport(targetPos);
    }
  }

  /**
   * Get target cell from controller position
   */
  private getTargetCell(
    controller: THREE.Group
  ): { x: number; y: number; z: number } | null {
    const worldPos = new THREE.Vector3();
    controller.getWorldPosition(worldPos);

    // Convert world position to cell coordinates
    const cellX = Math.floor(worldPos.x / this.cellSize);
    const cellY = Math.floor(Math.max(0, worldPos.y) / this.cellSize);
    const cellZ = Math.floor(worldPos.z / this.cellSize);

    return { x: cellX, y: cellY, z: cellZ };
  }

  /**
   * Toggle between edit and locomotion modes
   */
  toggleMode(): void {
    this.mode = this.mode === "edit" ? "locomotion" : "edit";
    this.setMode(this.mode);
    console.log(`Mode switched to: ${this.mode}`);
  }

  /**
   * Set controller mode
   */
  setMode(mode: ControllerMode): void {
    this.mode = mode;

    if (mode === "edit") {
      // Edit mode: show preview boxes and rays
      this.rightRay.visible = true;
      this.leftRay.visible = true;
      this.rightPreview.setMode("create");
      this.leftPreview.setMode("delete");
      this.teleportMarker.visible = false;
      this.teleportCurve.visible = false;

      // Update ray colors
      (this.rightRay.material as THREE.LineBasicMaterial).color.set(0x00ff00);
      (this.leftRay.material as THREE.LineBasicMaterial).color.set(0xff0000);
    } else {
      // Locomotion mode: show teleport visualization
      this.rightRay.visible = true;
      this.leftRay.visible = false;
      this.rightPreview.setMode("hidden");
      this.leftPreview.setMode("hidden");

      // Update ray color for teleport
      (this.rightRay.material as THREE.LineBasicMaterial).color.set(0x0088ff);
    }
  }

  /**
   * Update controller state (call every frame)
   */
  update(): void {
    if (this.mode === "edit") {
      // Update preview boxes in edit mode
      const rightCell = this.getTargetCell(this.controller1);
      const leftCell = this.getTargetCell(this.controller2);

      if (rightCell) {
        this.rightPreview.updatePosition(rightCell.x, rightCell.y, rightCell.z);
        this.rightPreview.show();
      } else {
        this.rightPreview.hide();
      }

      if (leftCell) {
        this.leftPreview.updatePosition(leftCell.x, leftCell.y, leftCell.z);
        this.leftPreview.show();
      } else {
        this.leftPreview.hide();
      }
    } else {
      // Update teleport visualization in locomotion mode
      this.updateTeleportVisualization();
    }
  }

  /**
   * Update teleport arc and marker
   */
  private updateTeleportVisualization(): void {
    const controller = this.controller1;
    const worldPos = new THREE.Vector3();
    const worldDir = new THREE.Vector3(0, 0, -1);

    controller.getWorldPosition(worldPos);
    worldDir.applyQuaternion(controller.quaternion);

    // Simple arc calculation
    const gravity = -9.8;
    const velocity = 5;
    const points: THREE.Vector3[] = [];
    let hitGround = false;
    let hitPoint = new THREE.Vector3();

    for (let i = 0; i <= 20; i++) {
      const t = i * 0.05;
      const x = worldPos.x + worldDir.x * velocity * t;
      const y = worldPos.y + worldDir.y * velocity * t + 0.5 * gravity * t * t;
      const z = worldPos.z + worldDir.z * velocity * t;

      if (y <= 0 && !hitGround) {
        hitGround = true;
        hitPoint.set(x, 0, z);
        points.push(hitPoint.clone());
        break;
      }

      points.push(new THREE.Vector3(x, y, z));
    }

    // Update curve geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.teleportCurve.geometry.dispose();
    this.teleportCurve.geometry = geometry;
    this.teleportCurve.visible = true;

    // Update marker position
    if (hitGround) {
      this.teleportMarker.position.copy(hitPoint);
      this.teleportMarker.visible = true;
    } else {
      this.teleportMarker.visible = false;
    }
  }

  /**
   * Adjust expansion/deletion size
   */
  adjustSize(
    controller: "right" | "left",
    axis: "x" | "y" | "z",
    delta: number
  ): void {
    const preview =
      controller === "right" ? this.rightPreview : this.leftPreview;
    preview.adjustSize(axis, delta);
    const size = preview.getSize();
    console.log(`${controller} controller size: ${size.x}x${size.y}x${size.z}`);
  }

  /**
   * Get current expansion size for right controller
   */
  getRightSize(): { x: number; y: number; z: number } {
    return this.rightPreview.getSize();
  }

  /**
   * Get current deletion size for left controller
   */
  getLeftSize(): { x: number; y: number; z: number } {
    return this.leftPreview.getSize();
  }

  /**
   * Set generation state (disable input during generation)
   */
  setGenerating(generating: boolean): void {
    this.isGenerating = generating;
  }

  /**
   * Get current mode
   */
  getMode(): ControllerMode {
    return this.mode;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.rightPreview.dispose();
    this.leftPreview.dispose();
    this.rightRay.geometry.dispose();
    (this.rightRay.material as THREE.Material).dispose();
    this.leftRay.geometry.dispose();
    (this.leftRay.material as THREE.Material).dispose();
    this.teleportMarker.geometry.dispose();
    (this.teleportMarker.material as THREE.Material).dispose();
    this.teleportCurve.geometry.dispose();
    (this.teleportCurve.material as THREE.Material).dispose();
  }
}
