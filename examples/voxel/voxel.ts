import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { voxelTileset } from "../tiles/voxels/tileset";
import type { VoxelTile3DConfig } from "../../src/wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "../../src/utils/SceneSetup";
import {
  createDemoUI,
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
  type DemoUIElements,
} from "../../src/utils/DemoUI";

// Worker types
interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface TileUpdateMessage {
  type: "tile_update";
  x: number;
  y: number;
  z: number;
  tileId: string;
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

type WorkerResponse =
  | ProgressMessage
  | TileUpdateMessage
  | CompleteMessage
  | ErrorMessage;

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
    showProgress(this.ui, "Generating...");
    setProgress(this.ui, 0);

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
        this.worker = new Worker(
          new URL("../../src/wfc.worker.ts", import.meta.url),
          {
            type: "module",
          }
        );
      }

      // Prepare geometry and materials for real-time rendering
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

      // Setup promise for worker completion with real-time tile rendering
      await new Promise<void>((resolve, reject) => {
        if (!this.worker) return reject(new Error("Worker not initialized"));

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const message = e.data;

          if (message.type === "progress") {
            setProgress(this.ui, message.progress * 100);
          } else if (message.type === "tile_update") {
            // Real-time tile update! Render immediately
            const { x, y, z, tileId } = message;

            if (!tileId || tileId === "air") return;

            const material = materials.get(tileId);
            if (!material) return;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
              x * this.voxelSize + this.voxelSize / 2,
              y * this.voxelSize + this.voxelSize / 2,
              z * this.voxelSize + this.voxelSize / 2
            );

            this.voxelGroup.add(mesh);
          } else if (message.type === "complete") {
            if (message.success) {
              resolve();
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

      // Generation complete! Voxels are already rendered via real-time updates
      console.log(
        `Generation complete! ${this.voxelGroup.children.length} voxels rendered in real-time.`
      );

      showProgress(
        this.ui,
        `Complete! ${this.voxelGroup.children.length} voxels`
      );
      setProgress(this.ui, 100);
      setTimeout(() => {
        hideProgress(this.ui);
      }, 1500);
    } catch (error) {
      console.error("Generation error:", error);
      showProgress(
        this.ui,
        `Failed: ${
          error instanceof Error ? error.message : "Generation failed"
        }`
      );
      setProgress(this.ui, 0);
      setProgressColor(this.ui, "#ef4444");
      setTimeout(() => {
        hideProgress(this.ui);
        setProgressColor(this.ui, "var(--focus-color)");
      }, 3000);
    }
  }

  private updateVoxelGroupPosition(): void {
    this.voxelGroup.position.set(
      (-this.width * this.voxelSize) / 2,
      (-this.height * this.voxelSize) / 2,
      (-this.depth * this.voxelSize) / 2
    );
  }

  private animate: () => void;
}

// Initialize demo
new VoxelDemo();
