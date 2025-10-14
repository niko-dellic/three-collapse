/**
 * Adjacency Demo - GLB UserData Workflow
 *
 * This example demonstrates the complete workflow:
 * 1. Load GLB files from a folder using import.meta.glob
 * 2. Read adjacency data from GLB userData
 * 3. Use in WFC generation
 */

import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import { DebugGrid } from "../../src/utils/DebugGrid";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
} from "../../src/utils/SceneSetup";
import { createDemoUI, type DemoUIElements } from "../../src/utils/DemoUI";
import {
  createTilesetEditor,
  type TilesetEditorElements,
  type TileTransform,
} from "../../src/utils/TilesetEditor";
import generate, {
  canExpand,
  resetExpansionState,
  shrinkGrid,
} from "../generate";
import { validateTileset } from "../../src/utils/TilesetValidator";

/**
 * Load tiles from GLB folder with embedded adjacency data
 */
async function loadTilesFromGLBFolder(
  folderPath: string
): Promise<ModelTile3DConfig[]> {
  console.log(`🔍 Loading GLB files from: ${folderPath}`);

  // Use import.meta.glob to discover all GLB files
  const glbModules = import.meta.glob("/public/models/blocks/*.glb", {
    eager: false,
    query: "?url",
    import: "default",
  });

  const loader = new GLTFLoader();
  const tiles: ModelTile3DConfig[] = [];
  let tilesWithAdjacencies = 0;

  // Load each GLB file
  for (const [path, loadModule] of Object.entries(glbModules)) {
    try {
      const url = (await loadModule()) as string;
      const cleanPath = url.startsWith("/") ? url : path.replace("/public", "");

      // Extract tile ID from filename
      const parts = cleanPath.split("/");
      const filename = parts[parts.length - 1];
      const tileId = filename.replace(/\.glb$/i, "");

      // Load the GLB
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(cleanPath, resolve, undefined, reject);
      });

      // Check for adjacency data in userData
      // Try scene.children[0] first (individual tile export format)
      // Then fall back to scene.userData (old format)
      const tile = gltf.scene.children[0];
      tile.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.side = THREE.DoubleSide;
        }
      });
      const userData = tile?.userData || gltf.scene.userData || {};

      // Extract adjacency and weight
      const adjacency = userData.adjacency || {};
      const weight = userData.weight || 1;

      const hasAdjacencies = Object.keys(adjacency).length > 0;
      if (hasAdjacencies) {
        tilesWithAdjacencies++;
        console.log(`  ✓ ${tileId}: adjacencies loaded from userData`);
      } else {
        console.log(`  ○ ${tileId}: no adjacency data (fresh tile)`);
      }

      // Create tile config
      const config: ModelTile3DConfig = {
        id: tileId,
        model: cleanPath,
        weight,
        adjacency,
      };

      tiles.push(config);
    } catch (error) {
      console.error(`  ✗ Error loading ${path}:`, error);
    }
  }

  console.log(
    `\n📦 Loaded ${tiles.length} tiles (${tilesWithAdjacencies} with adjacency data)\n`
  );

  return tiles;
}

/**
 * Demo class for GLB-based WFC with embedded adjacency data
 */
class AdjacencyDemo {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  glbLoader: GLBTileLoader;
  modelRenderer: InstancedModelRenderer | null = null;
  debugGrid: DebugGrid;

  width = 10;
  height = 3;
  depth = 10;
  cellSize = 2;

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
  tiles: ModelTile3DConfig[];

  constructor(tiles: ModelTile3DConfig[]) {
    this.tiles = tiles;
    this.glbLoader = new GLBTileLoader();

    // Validate tileset
    console.log("🔍 Validating tileset...");
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

    // Setup scene
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
      title: "GLB UserData Demo",
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

    console.log("\n✨ Demo initialized!");
    console.log("💡 Click 'Generate' to create a world with your tiles\n");
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
    await generate(this as any, this.tiles, isExpansion);
  }

  private async shrink(): Promise<void> {
    await shrinkGrid(this as any, this.width, this.height, this.depth);
  }

  private async shrinkThenExpand(): Promise<void> {
    // First shrink to the smaller dimensions
    await shrinkGrid(this as any, this.width, this.height, this.depth);
    // Then expand if needed
    await generate(this as any, this.tiles, true);
  }
}

// Initialize demo
(async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         🎨 Adjacency Demo - GLB UserData Workflow             ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  This demo loads GLB files with embedded adjacency data       ║
║  from the blocks folder and uses them for WFC generation.     ║
║                                                               ║
║  The adjacency rules are read from each GLB's userData,       ║
║  created using the Adjacency Builder tool.                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  try {
    // Load tiles from blocks folder with embedded adjacency data
    const tiles = await loadTilesFromGLBFolder("/public/models/blocks");

    // Create the demo with loaded tiles
    new AdjacencyDemo(tiles);
  } catch (error) {
    console.error("❌ Error initializing demo:", error);
    alert("Error loading demo. Check console for details.");
  }
})();
