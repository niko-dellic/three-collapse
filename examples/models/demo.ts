import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { simpleModelTileset } from "../tiles/models/tileset";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "../../src/utils/SceneSetup";

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

class ModelDemo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private worker: Worker | null = null;

  private glbLoader: GLBTileLoader;
  private modelRenderer: InstancedModelRenderer | null = null;

  private width = 10;
  private height = 8;
  private depth = 10;
  private cellSize = 1;

  private tiles: ModelTile3DConfig[];
  private currentSeed: number = Date.now();
  private isLoading: boolean = false;
  private animate: () => void;

  private statusContainer: HTMLDivElement;
  private statusText: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private generateBtn: HTMLButtonElement;
  private randomBtn: HTMLButtonElement;

  constructor() {
    this.tiles = simpleModelTileset;
    this.glbLoader = new GLBTileLoader();

    // Setup scene, camera, renderer, and controls
    const sceneSetup = createScene({
      backgroundColor: 0xff0000,
      fogColor: 0x1a1a2e,
      fogNear: 15,
      fogFar: 40,
      cameraPosition: { x: 15, y: 12, z: 15 },
      enableShadows: true,
      maxPolarAngle: Math.PI / 2,
    });

    this.scene = sceneSetup.scene;
    this.camera = sceneSetup.camera;
    this.renderer = sceneSetup.renderer;
    this.controls = sceneSetup.controls;

    // Add lighting
    addLighting(this.scene, {
      ambient: { color: 0xffffff, intensity: 0.4 },
      directional: {
        color: 0xffffff,
        intensity: 0.8,
        position: { x: 20, y: 30, z: 20 },
        castShadow: true,
        shadowCamera: { left: -20, right: 20, top: 20, bottom: -20 },
        shadowMapSize: 2048,
      },
      hemisphere: {
        skyColor: 0x87ceeb,
        groundColor: 0x8b4513,
        intensity: 0.3,
      },
    });

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
    uiContainer.className = "ui-container";
    document.body.appendChild(uiContainer);

    // Title
    const title = document.createElement("h2");
    title.className = "ui-title";
    title.textContent = "3D Model WFC Demo";
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
      30,
      (value) => {
        this.width = value;
        info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
        this.updateRendererOffset();
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
        this.updateRendererOffset();
      }
    );
    uiContainer.appendChild(heightContainer);

    // Depth slider
    const depthContainer = this.createSlider(
      "Depth",
      this.depth,
      5,
      30,
      (value) => {
        this.depth = value;
        info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
        this.updateRendererOffset();
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
    seedInput.className = "seed-input";
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
    randomBtn.textContent = "Random";
    randomBtn.addEventListener("click", () => {
      this.currentSeed = Date.now();
      seedInput.value = this.currentSeed.toString();
    });
    uiContainer.appendChild(randomBtn);

    // Status display
    const statusContainer = document.createElement("div");
    statusContainer.className = "status-container";

    const statusText = document.createElement("div");
    statusText.textContent = "Status: Ready";
    statusContainer.appendChild(statusText);

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";

    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressBar.appendChild(progressFill);

    statusContainer.appendChild(progressBar);
    uiContainer.appendChild(statusContainer);

    // Store references
    this.statusContainer = statusContainer;
    this.statusText = statusText;
    this.progressFill = progressFill;
    this.generateBtn = generateBtn;
    this.randomBtn = randomBtn;
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

  private updateRendererOffset(): void {
    if (this.modelRenderer) {
      this.modelRenderer.setOffset(
        (-this.width * this.cellSize) / 2,
        (-this.height * this.cellSize) / 2,
        (-this.depth * this.cellSize) / 2
      );
    }
  }

  private async generate(): Promise<void> {
    if (this.isLoading) return;

    const statusContainer = this.statusContainer;
    const statusText = this.statusText;
    const progressFill = this.progressFill;
    const generateBtn = this.generateBtn;
    const randomBtn = this.randomBtn;

    this.isLoading = true;
    statusContainer.classList.add("visible");
    statusText.textContent = "Loading models...";
    progressFill.style.width = "0%";
    generateBtn.disabled = true;
    randomBtn.disabled = true;

    try {
      // Load models
      statusText.textContent = "Loading GLB models...";
      const modelData = await this.glbLoader.loadTileset(this.tiles);
      progressFill.style.width = "30%";

      // Clear existing renderer
      if (this.modelRenderer) {
        this.modelRenderer.dispose();
      }

      // Create new renderer with loaded models
      this.modelRenderer = new InstancedModelRenderer(
        this.scene,
        modelData,
        this.cellSize
      );

      // Set offset to center the grid
      this.modelRenderer.setOffset(
        (-this.width * this.cellSize) / 2,
        (-this.height * this.cellSize) / 2,
        (-this.depth * this.cellSize) / 2
      );

      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(
          new URL("../../src/wfc.worker.ts", import.meta.url),
          { type: "module" }
        );
      }

      // Run WFC algorithm
      statusText.textContent = "Running WFC algorithm...";
      const result = await new Promise<string[][][]>((resolve, reject) => {
        if (!this.worker) return reject(new Error("Worker not initialized"));

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const message = e.data;

          if (message.type === "progress") {
            const progress = 30 + message.progress * 60; // 30-90%
            progressFill.style.width = `${progress}%`;
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
          tiles: this.tiles,
          seed: this.currentSeed,
        });
      });

      // Render using instanced meshes
      statusText.textContent = "Rendering instances...";
      progressFill.style.width = "95%";

      // Filter out 'air' tiles before rendering
      const filteredGrid = result.map((xLayer) =>
        xLayer.map((yLayer) =>
          yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
        )
      );

      this.modelRenderer.render(filteredGrid);

      const stats = this.modelRenderer.getStats();
      statusText.textContent = `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`;
      progressFill.style.width = "100%";

      setTimeout(() => {
        statusContainer.classList.remove("visible");
      }, 2000);
    } catch (error) {
      console.error("Generation error:", error);
      statusText.textContent = `Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      progressFill.style.width = "0%";
      progressFill.style.backgroundColor = "#ef4444";

      setTimeout(() => {
        progressFill.style.backgroundColor = "#4ade80";
      }, 3000);
    } finally {
      this.isLoading = false;
      generateBtn.disabled = false;
      randomBtn.disabled = false;
    }
  }
}

// Initialize demo
new ModelDemo();
