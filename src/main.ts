import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { voxelTileset } from "../examples/tiles/voxels/tileset";
import type { VoxelTile3DConfig } from "./wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "./utils/SceneSetup";
import {
  createDemoUI,
  showProgress,
  hideProgress,
  setButtonEnabled,
  type DemoUIElements,
} from "./utils/DemoUI";

// Worker types
interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface CompleteMessage {
  type: "complete";
  success: boolean;
  data?: string[][][];
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

class VoxelDemo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private voxelGroup: THREE.Group;
  private worker: Worker | null = null;

  private width = 30;
  private height = 5;
  private depth = 30;
  private voxelSize = 1;

  private tiles: Map<string, VoxelTile3DConfig>;
  private currentSeed: number = Date.now();
  private ui: DemoUIElements;

  constructor() {
    // Create tile map
    this.tiles = new Map(voxelTileset.map((t: VoxelTile3DConfig) => [t.id, t]));

    // Setup scene, camera, renderer, and controls
    const sceneSetup = createScene({
      backgroundColor: 0x000000,
      fogColor: 0x000000,
      fogNear: 10,
      fogFar: 50,
      cameraPosition: { x: 15, y: 15, z: 15 },
    });

    this.scene = sceneSetup.scene;
    this.camera = sceneSetup.camera;
    this.renderer = sceneSetup.renderer;
    this.controls = sceneSetup.controls;

    // Add lighting
    addLighting(this.scene, {
      ambient: { color: 0xffffff, intensity: 0.6 },
      directional: {
        color: 0xffffff,
        intensity: 0.6,
        position: { x: 10, y: 20, z: 10 },
      },
    });

    // Create voxel group
    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    // Center the voxel group
    this.voxelGroup.position.set(
      (-this.width * this.voxelSize) / 2,
      (-this.height * this.voxelSize) / 2,
      (-this.depth * this.voxelSize) / 2
    );

    // Setup UI
    this.ui = createDemoUI({
      title: "3D Wave Function Collapse",
      width: this.width,
      height: this.height,
      depth: this.depth,
      seed: this.currentSeed,
      onGenerate: () => this.generate(),
      onRandomSeed: () => {
        this.currentSeed = Date.now();
      },
      onSeedChange: (seed) => {
        this.currentSeed = seed;
      },
      onWidthChange: (width) => {
        this.width = width;
        this.updateVoxelGroupPosition();
      },
      onHeightChange: (height) => {
        this.height = height;
        this.updateVoxelGroupPosition();
      },
      onDepthChange: (depth) => {
        this.depth = depth;
        this.updateVoxelGroupPosition();
      },
      widthRange: { min: 5, max: 50 },
      heightRange: { min: 1, max: 20 },
      depthRange: { min: 5, max: 50 },
    });

    // Handle window resize
    const resizeHandler = createResizeHandler(this.camera, this.renderer);
    window.addEventListener("resize", resizeHandler);

    // Start animation
    this.animate = createAnimationLoop(
      this.renderer,
      this.scene,
      this.camera,
      this.controls
    );
    this.animate();
  }

  private async generate(): Promise<void> {
    // Show progress
    showProgress(this.ui.progressContainer, this.ui.progressFill, 0);
    setButtonEnabled(this.ui.generateBtn, false);

    // Clear existing voxels
    while (this.voxelGroup.children.length > 0) {
      const child = this.voxelGroup.children[0];
      this.voxelGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    try {
      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(new URL("./wfc.worker.ts", import.meta.url), {
          type: "module",
        });
      }

      // Setup promise for worker completion
      const result = await new Promise<string[][][]>((resolve, reject) => {
        if (!this.worker) return reject(new Error("Worker not initialized"));

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const message = e.data;

          if (message.type === "progress") {
            showProgress(
              this.ui.progressContainer,
              this.ui.progressFill,
              message.progress
            );
          } else if (message.type === "complete") {
            if (message.success && message.data) {
              resolve(message.data);
            } else {
              reject(new Error("Generation failed - contradiction occurred"));
            }
          } else if (message.type === "error") {
            reject(new Error(message.message));
          }
        };

        // Send generation request
        this.worker.postMessage({
          type: "generate",
          width: this.width,
          height: this.height,
          depth: this.depth,
          tiles: voxelTileset,
          seed: this.currentSeed,
        });
      });

      // Render voxels
      this.renderVoxels(result);

      showProgress(this.ui.progressContainer, this.ui.progressFill, 1);
      setTimeout(() => {
        hideProgress(this.ui.progressContainer);
      }, 500);
    } catch (error) {
      console.error("Generation error:", error);
      alert(error instanceof Error ? error.message : "Generation failed");
      hideProgress(this.ui.progressContainer);
    } finally {
      setButtonEnabled(this.ui.generateBtn, true);
    }
  }

  private updateVoxelGroupPosition(): void {
    this.voxelGroup.position.set(
      (-this.width * this.voxelSize) / 2,
      (-this.height * this.voxelSize) / 2,
      (-this.depth * this.voxelSize) / 2
    );
  }

  private renderVoxels(data: string[][][]): void {
    const geometry = new THREE.BoxGeometry(
      this.voxelSize,
      this.voxelSize,
      this.voxelSize
    );
    const materials = new Map<string, THREE.MeshLambertMaterial>();

    // Create materials for each tile type
    for (const [id, tile] of this.tiles) {
      if (id === "air") continue; // Don't render air

      const material = new THREE.MeshLambertMaterial({
        color: tile.color,
      });
      materials.set(id, material);
    }

    // Create voxel mesh
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < this.depth; z++) {
          const tileId = data[x][y][z];

          if (!tileId || tileId === "air") continue;

          const material = materials.get(tileId);
          if (!material) continue;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(
            x * this.voxelSize + this.voxelSize / 2,
            y * this.voxelSize + this.voxelSize / 2,
            z * this.voxelSize + this.voxelSize / 2
          );

          this.voxelGroup.add(mesh);
        }
      }
    }
  }

  private animate: () => void;
}

// Initialize demo
new VoxelDemo();
