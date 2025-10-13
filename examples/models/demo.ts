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
import {
  createDemoUI,
  updateGridInfo,
  type DemoUIElements,
} from "../../src/utils/DemoUI";
import generate, {
  canExpand,
  resetExpansionState,
  shrinkGrid,
} from "./generate";
import { validateTileset } from "../../src/utils/TilesetValidator";

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

  ui: DemoUIElements;
  expansionCheckbox: HTMLInputElement;
  workerCountInput: HTMLInputElement;
  useWorkersCheckbox: HTMLInputElement;

  previousWidth: number = 10;
  previousHeight: number = 8;
  previousDepth: number = 10;

  expansionMode: boolean = true;
  useWorkers: boolean = true;
  workerCount: number = navigator.hardwareConcurrency || 4;

  constructor() {
    this.tiles = mixedModelTileset;
    this.glbLoader = new GLBTileLoader();

    // Validate tileset on startup
    console.log("Validating tileset...");
    const validation = validateTileset(this.tiles);
    if (!validation.valid) {
      console.warn("⚠️ Tileset validation found issues:");
      for (const issue of validation.issues) {
        const prefix = issue.severity === "error" ? "❌" : "⚠️";
        console.warn(`${prefix} ${issue.message}`);
      }
    }
    if (validation.suggestions.length > 0) {
      console.log("💡 Suggestions:");
      for (const suggestion of validation.suggestions) {
        console.log(`  - ${suggestion}`);
      }
    }
    if (validation.valid) {
      console.log("✅ Tileset validation passed!");
    }

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
    this.ui = createDemoUI({
      title: "3D Model WFC Demo",
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
        this.onGridSizeChange();
      },
      onHeightChange: (height) => {
        this.height = height;
        this.onGridSizeChange();
      },
      onDepthChange: (depth) => {
        this.depth = depth;
        this.onGridSizeChange();
      },
      widthRange: { min: 5, max: 30 },
      heightRange: { min: 1, max: 20 },
      depthRange: { min: 5, max: 30 },
    });

    // Add custom UI elements (expansion mode and worker config)
    this.setupAdditionalUI();

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

  private setupAdditionalUI(): void {
    const uiContainer = this.ui.container;

    // Find the first separator (after grid controls) and insert custom elements after it
    const separator = uiContainer.querySelector("hr");
    if (!separator) return;

    // Create expansion mode section
    const expansionContainer = document.createElement("div");
    expansionContainer.className = "expansion-container";
    expansionContainer.style.display = "flex";
    expansionContainer.style.alignItems = "center";
    expansionContainer.style.gap = "8px";
    expansionContainer.style.marginBottom = "12px";

    this.expansionCheckbox = document.createElement("input");
    this.expansionCheckbox.type = "checkbox";
    this.expansionCheckbox.id = "expansion-mode";
    this.expansionCheckbox.checked = this.expansionMode;
    this.expansionCheckbox.addEventListener("change", () => {
      this.expansionMode = this.expansionCheckbox.checked;
      if (!this.expansionMode) {
        resetExpansionState();
      }
    });
    expansionContainer.appendChild(this.expansionCheckbox);

    const expansionLabel = document.createElement("label");
    expansionLabel.htmlFor = "expansion-mode";
    expansionLabel.textContent = "Auto-expand mode";
    expansionLabel.style.cursor = "pointer";
    expansionContainer.appendChild(expansionLabel);

    // Insert after the first separator
    separator.insertAdjacentElement("afterend", expansionContainer);

    // Create worker configuration section
    const workerSectionTitle = document.createElement("div");
    workerSectionTitle.className = "section-title";
    workerSectionTitle.textContent = "Workers";
    workerSectionTitle.style.marginTop = "8px";
    expansionContainer.insertAdjacentElement("afterend", workerSectionTitle);

    // Use workers checkbox
    const useWorkersContainer = document.createElement("div");
    useWorkersContainer.style.display = "flex";
    useWorkersContainer.style.alignItems = "center";
    useWorkersContainer.style.gap = "8px";
    useWorkersContainer.style.marginBottom = "8px";

    this.useWorkersCheckbox = document.createElement("input");
    this.useWorkersCheckbox.type = "checkbox";
    this.useWorkersCheckbox.id = "use-workers";
    this.useWorkersCheckbox.checked = this.useWorkers;
    this.useWorkersCheckbox.addEventListener("change", () => {
      this.useWorkers = this.useWorkersCheckbox.checked;
      this.workerCountInput.disabled = !this.useWorkers;
    });
    useWorkersContainer.appendChild(this.useWorkersCheckbox);

    const useWorkersLabel = document.createElement("label");
    useWorkersLabel.htmlFor = "use-workers";
    useWorkersLabel.textContent = "Enable multi-worker";
    useWorkersLabel.style.cursor = "pointer";
    useWorkersContainer.appendChild(useWorkersLabel);

    workerSectionTitle.insertAdjacentElement("afterend", useWorkersContainer);

    // Worker count input
    const workerCountContainer = document.createElement("div");
    workerCountContainer.style.display = "flex";
    workerCountContainer.style.alignItems = "center";
    workerCountContainer.style.gap = "8px";
    workerCountContainer.style.marginBottom = "12px";

    const workerCountLabel = document.createElement("label");
    workerCountLabel.textContent = "Worker count:";
    workerCountLabel.style.fontSize = "12px";
    workerCountContainer.appendChild(workerCountLabel);

    this.workerCountInput = document.createElement("input");
    this.workerCountInput.type = "number";
    this.workerCountInput.min = "1";
    this.workerCountInput.max = (navigator.hardwareConcurrency || 8).toString();
    this.workerCountInput.value = this.workerCount.toString();
    this.workerCountInput.disabled = !this.useWorkers;
    this.workerCountInput.style.width = "60px";
    this.workerCountInput.addEventListener("change", () => {
      const value = parseInt(this.workerCountInput.value);
      if (value > 0 && value <= (navigator.hardwareConcurrency || 8)) {
        this.workerCount = value;
      }
    });
    workerCountContainer.appendChild(this.workerCountInput);

    const maxWorkersNote = document.createElement("span");
    maxWorkersNote.textContent = `(max: ${navigator.hardwareConcurrency || 8})`;
    maxWorkersNote.style.fontSize = "11px";
    maxWorkersNote.style.opacity = "0.7";
    workerCountContainer.appendChild(maxWorkersNote);

    useWorkersContainer.insertAdjacentElement("afterend", workerCountContainer);

    // Add separator before seed section
    const workerSeparator = document.createElement("hr");
    workerCountContainer.insertAdjacentElement("afterend", workerSeparator);
  }

  private onGridSizeChange(): void {
    // Check if we should auto-expand or shrink
    if (this.expansionMode && canExpand()) {
      // Check if size changed
      const widthChanged = this.width !== this.previousWidth;
      const heightChanged = this.height !== this.previousHeight;
      const depthChanged = this.depth !== this.previousDepth;

      // Determine if we're expanding, shrinking, or both
      const widthIncreased = this.width > this.previousWidth;
      const heightIncreased = this.height > this.previousHeight;
      const depthIncreased = this.depth > this.previousDepth;

      const widthDecreased = this.width < this.previousWidth;
      const heightDecreased = this.height < this.previousHeight;
      const depthDecreased = this.depth < this.previousDepth;

      const anySizeIncreased =
        widthIncreased || heightIncreased || depthIncreased;
      const anySizeDecreased =
        widthDecreased || heightDecreased || depthDecreased;

      if (anySizeDecreased && !anySizeIncreased) {
        // Only shrinking - remove tiles
        setTimeout(() => {
          if (this.expansionMode && !this.isLoading) {
            this.shrink();
          }
        }, 500);
      } else if (anySizeIncreased && !anySizeDecreased) {
        // Only expanding - add tiles
        setTimeout(() => {
          if (this.expansionMode && !this.isLoading) {
            this.generate(true);
          }
        }, 500);
      } else if (anySizeIncreased && anySizeDecreased) {
        // Mixed expansion and shrinking - do shrink first, then expand
        setTimeout(() => {
          if (this.expansionMode && !this.isLoading) {
            this.shrinkThenExpand();
          }
        }, 500);
      }
    }

    // Update previous sizes
    this.previousWidth = this.width;
    this.previousHeight = this.height;
    this.previousDepth = this.depth;
  }

  private async generate(isExpansion: boolean = false): Promise<void> {
    await generate(this, this.tiles, isExpansion);
  }

  private async shrink(): Promise<void> {
    await shrinkGrid(this, this.width, this.height, this.depth);
  }

  private async shrinkThenExpand(): Promise<void> {
    // First shrink to the smaller dimensions
    await shrinkGrid(this, this.width, this.height, this.depth);
    // Then expand if needed
    await generate(this, this.tiles, true);
  }
}

// Initialize demo
new ModelDemo();
