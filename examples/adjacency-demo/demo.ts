/**
 * Adjacency Demo - GLB UserData Workflow
 *
 * This example demonstrates the complete workflow:
 * 1. Load GLB files from a folder using import.meta.glob
 * 2. Read adjacency data from GLB userData
 * 3. Use in WFC generation
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import { createScene } from "../../src/utils/SceneSetup";
import { createDebugUI, type DemoUIElements } from "../../src/utils/debugUI";
import generate, { canExpand, shrinkGrid, getGenerator } from "../generate";
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

      // Extract filename (without extension)
      const parts = cleanPath.split("/");
      const filename = parts[parts.length - 1];
      const filenameWithoutExt = filename.replace(/\.glb$/i, "");

      // Load the GLB
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(cleanPath, resolve, undefined, reject);
      });

      // Traverse scene to find all mesh objects
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
        }
      });

      // Process each mesh as a separate tile
      meshes.forEach((mesh) => {
        // Set material to double-sided
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              mat.side = THREE.DoubleSide;
            });
          } else {
            mesh.material.side = THREE.DoubleSide;
          }
        }

        // Generate tile ID: check userData.tileId first, then use filename_meshname
        const tileId =
          mesh.userData.tileId || `${filenameWithoutExt}_${mesh.name}`;

        // Extract adjacency and weight from mesh userData
        const userData = mesh.userData;
        const adjacency = userData.adjacency || {};
        const weight = userData.weight || 1;

        const hasAdjacencies = Object.keys(adjacency).length > 0;
        if (hasAdjacencies) tilesWithAdjacencies++;

        // Create tile config
        const config: ModelTile3DConfig = {
          id: tileId,
          model: () => mesh,
          weight,
          adjacency,
          rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        };

        tiles.push(config);
      });
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
export class AdjacencyDemo {
  scene: THREE.Scene;
  glbLoader: GLBTileLoader;
  modelRenderer: InstancedModelRenderer | null = null;

  width = 10;
  height = 3;
  depth = 10;
  cellSize = 2;

  currentSeed: number = Date.now();
  isLoading: boolean = false;
  ui: DemoUIElements;
  previousWidth: number = 10;
  previousHeight: number = 8;
  previousDepth: number = 10;

  expansionMode: boolean = true;
  useWorkers: boolean = true;
  workerCount: number = navigator.hardwareConcurrency || 4;
  tiles: ModelTile3DConfig[];

  constructor(tiles: ModelTile3DConfig[], cellSize?: number) {
    this.tiles = tiles;
    if (cellSize) this.cellSize = cellSize;
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
    if (validation.valid) console.log("✅ Tileset validation passed!");

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
    if (this.modelRenderer) {
      this.modelRenderer.setCellSize(cellSize);
    }
  }

  getDebugGrid() {
    const generator = getGenerator();
    return generator ? generator.getDebugGrid() : null;
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
    const tiles = await loadTilesFromGLBFolder("./models/blocks");

    // Create the demo with loaded tiles
    new AdjacencyDemo(tiles);
  } catch (error) {
    console.error("❌ Error initializing demo:", error);
    alert("Error loading demo. Check console for details.");
  }
})();
