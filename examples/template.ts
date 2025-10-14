import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mixedModelTileset } from "./tiles/models/tileset";
import { GLBTileLoader } from "../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../src/renderers/InstancedModelRenderer";
import { DebugGrid } from "../src/utils/DebugGrid";
import type { ModelTile3DConfig } from "../src/wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "../src/utils/SceneSetup";
import { createDemoUI, type DemoUIElements } from "../src/utils/DemoUI";
import {
  createTilesetEditor,
  type TilesetEditorElements,
  type TileTransform,
} from "../src/utils/TilesetEditor";
import generate, {
  canExpand,
  resetExpansionState,
  shrinkGrid,
} from "./generate";
import { validateTileset } from "../src/utils/TilesetValidator";

export default class Demo {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  worker: Worker | null = null;
  glbLoader: GLBTileLoader;
  modelRenderer: InstancedModelRenderer | null = null;
  debugGrid: DebugGrid;

  width = 10;
  height = 8;
  depth = 10;
  cellSize = 1;

  currentSeed: number = Date.now();
  isLoading: boolean = false;
  animate: () => void;

  ui: DemoUIElements;
  tilesetEditor: TilesetEditorElements;

  previousWidth: number = 10;
  previousHeight: number = 8;
  previousDepth: number = 10;

  expansionMode: boolean = true;
  useWorkers: boolean = true;
  workerCount: number = navigator.hardwareConcurrency || 4;
  tiles: ModelTile3DConfig[] = mixedModelTileset;

  constructor(tiles?: ModelTile3DConfig[], cellSize?: number) {
    if (tiles) this.tiles = tiles;
    if (cellSize) this.cellSize = cellSize;
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

    // Initialize debug grid
    this.debugGrid = new DebugGrid(this.scene, this.cellSize);

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
      // Expansion mode controls
      showExpansionToggle: true,
      expansionMode: this.expansionMode,
      onExpansionChange: (enabled) => {
        this.expansionMode = enabled;
        if (!this.expansionMode) {
          resetExpansionState();
        }
      },
      // Worker controls
      showWorkerControls: true,
      useWorkers: this.useWorkers,
      workerCount: this.workerCount,
      onUseWorkersChange: (enabled) => {
        this.useWorkers = enabled;
      },
      onWorkerCountChange: (count) => {
        this.workerCount = count;
      },
      // Debug controls
      showDebugControls: true,
      debugWireframe: false,
      onDebugWireframeChange: (enabled) => {
        this.debugGrid.setVisible(enabled);
      },
    });

    // Setup tileset editor
    this.tilesetEditor = createTilesetEditor({
      tiles: this.tiles,
      parentGUI: this.ui.gui,
      onTransformChange: (tileId: string, transform: TileTransform) => {
        if (this.modelRenderer) {
          this.modelRenderer.updateTileTransform(tileId, {
            position: new THREE.Vector3(
              transform.position.x,
              transform.position.y,
              transform.position.z
            ),
            rotation: new THREE.Euler(
              transform.rotation.x,
              transform.rotation.y,
              transform.rotation.z
            ),
            scale: new THREE.Vector3(
              transform.scale.x,
              transform.scale.y,
              transform.scale.z
            ),
          });
        }
      },
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

  private onGridSizeChange(): void {
    // Check if we should auto-expand or shrink
    if (this.expansionMode && canExpand()) {
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
