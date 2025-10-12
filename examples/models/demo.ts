import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { simpleModelTileset, mixedModelTileset } from "../tiles/models/tileset";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "../../src/utils/SceneSetup";
import generate from "./generate";

export class ModelDemo {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  worker: Worker | null = null;

  glbLoader: GLBTileLoader;
  modelRenderer: InstancedModelRenderer | null = null;

  width = 10;
  height = 8;
  depth = 10;
  cellSize = 1;

  tiles: ModelTile3DConfig[];
  currentSeed: number = Date.now();
  isLoading: boolean = false;
  animate: () => void;

  statusContainer: HTMLDivElement;
  statusText: HTMLDivElement;
  progressFill: HTMLDivElement;
  generateBtn: HTMLButtonElement;
  randomBtn: HTMLButtonElement;

  constructor() {
    this.tiles = mixedModelTileset;
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
    await generate(this, this.tiles);
  }
}

// Initialize demo
new ModelDemo();
