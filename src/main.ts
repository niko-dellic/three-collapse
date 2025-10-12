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
    this.setupUI();

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

  private setupUI(): void {
    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.className = "ui-container voxel-demo";
    document.body.appendChild(uiContainer);

    // Title
    const title = document.createElement("h2");
    title.className = "ui-title";
    title.textContent = "3D Wave Function Collapse";
    uiContainer.appendChild(title);

    // Info
    const info = document.createElement("div");
    info.className = "grid-info";
    info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
    uiContainer.appendChild(info);

    // Grid size controls
    const gridControlsTitle = document.createElement("div");
    gridControlsTitle.className = "section-title";
    gridControlsTitle.textContent = "Grid Size";
    uiContainer.appendChild(gridControlsTitle);

    // Width slider
    const widthContainer = this.createSlider(
      "Width",
      this.width,
      5,
      50,
      (value) => {
        this.width = value;
        info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
        this.updateVoxelGroupPosition();
      }
    );
    uiContainer.appendChild(widthContainer);

    // Height slider
    const heightContainer = this.createSlider(
      "Height",
      this.height,
      3,
      20,
      (value) => {
        this.height = value;
        info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
        this.updateVoxelGroupPosition();
      }
    );
    uiContainer.appendChild(heightContainer);

    // Depth slider
    const depthContainer = this.createSlider(
      "Depth",
      this.depth,
      5,
      50,
      (value) => {
        this.depth = value;
        info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
        this.updateVoxelGroupPosition();
      }
    );
    uiContainer.appendChild(depthContainer);

    // Separator
    const separator = document.createElement("hr");
    uiContainer.appendChild(separator);

    // Seed input
    const seedContainer = document.createElement("div");
    seedContainer.className = "seed-container";

    const seedLabel = document.createElement("label");
    seedLabel.className = "seed-label";
    seedLabel.textContent = "Seed: ";
    seedContainer.appendChild(seedLabel);

    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = this.currentSeed.toString();
    seedInput.addEventListener("change", () => {
      this.currentSeed = parseInt(seedInput.value) || Date.now();
    });
    seedContainer.appendChild(seedInput);

    uiContainer.appendChild(seedContainer);

    // Generate button
    const generateBtn = document.createElement("button");
    generateBtn.textContent = "Generate";
    generateBtn.addEventListener("click", () => this.generate());
    uiContainer.appendChild(generateBtn);

    // Random seed button
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "Random Seed";
    randomBtn.addEventListener("click", () => {
      this.currentSeed = Date.now();
      seedInput.value = this.currentSeed.toString();
    });
    uiContainer.appendChild(randomBtn);

    // Progress bar
    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-container";

    const progressLabel = document.createElement("div");
    progressLabel.className = "progress-label";
    progressLabel.textContent = "Generating...";
    progressContainer.appendChild(progressLabel);

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";

    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressBar.appendChild(progressFill);

    progressContainer.appendChild(progressBar);
    uiContainer.appendChild(progressContainer);

    // Store references for later use
    (this as any).progressContainer = progressContainer;
    (this as any).progressFill = progressFill;
    (this as any).generateBtn = generateBtn;
  }

  private async generate(): Promise<void> {
    const progressContainer = (this as any).progressContainer as HTMLDivElement;
    const progressFill = (this as any).progressFill as HTMLDivElement;
    const generateBtn = (this as any).generateBtn as HTMLButtonElement;

    // Show progress
    progressContainer.classList.add("visible");
    progressFill.style.width = "0%";
    generateBtn.disabled = true;

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
            progressFill.style.width = `${message.progress * 100}%`;
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

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressContainer.classList.remove("visible");
      }, 500);
    } catch (error) {
      console.error("Generation error:", error);
      alert(error instanceof Error ? error.message : "Generation failed");
      progressContainer.classList.remove("visible");
    } finally {
      generateBtn.disabled = false;
    }
  }

  private createSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "slider-container";

    const labelRow = document.createElement("div");
    labelRow.className = "slider-label-row";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    labelRow.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = "slider-value";
    valueEl.textContent = value.toString();
    labelRow.appendChild(valueEl);

    container.appendChild(labelRow);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.value = value.toString();
    slider.addEventListener("input", () => {
      const newValue = parseInt(slider.value);
      valueEl.textContent = newValue.toString();
      onChange(newValue);
    });

    container.appendChild(slider);
    return container;
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
