import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mixedModelTileset } from "./tiles/models/tileset";
import { GLBTileLoader } from "../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../src/renderers/InstancedModelRenderer";
import type { ModelTile3DConfig } from "../src/wfc3d";
import { createScene } from "../src/utils/SceneSetup";
import { createDebugUI, type DemoUIElements } from "../src/utils/debugUI";
import generate, { canExpand, shrinkGrid, getGenerator } from "./generate";
import { validateTileset } from "../src/utils/TilesetValidator";

export default class Demo {
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

  currentSeed: number = Date.now();
  isLoading: boolean = false;

  ui: DemoUIElements;

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

    // Setup UI (including tileset editor)
    this.ui = createDebugUI(this);
  }

  async generate(isExpansion: boolean = false): Promise<void> {
    await generate(this, this.tiles, isExpansion);
  }

  canExpand(): boolean {
    return canExpand();
  }

  async shrinkGrid(
    width: number,
    height: number,
    depth: number
  ): Promise<void> {
    await shrinkGrid(this, width, height, depth);
  }

  onCellSizeChange(cellSize: number): void {
    this.cellSize = cellSize;
    const generator = getGenerator();
    if (generator) {
      generator.setCellSize(cellSize);
    }
    if (this.modelRenderer) this.modelRenderer.setCellSize(cellSize);
  }

  getDebugGrid() {
    const generator = getGenerator();
    return generator ? generator.getDebugGrid() : null;
  }
}
