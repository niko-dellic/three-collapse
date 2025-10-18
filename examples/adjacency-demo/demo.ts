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
import type { ModelTile3DConfig } from "../../src/wfc3d";
import { createScene, updateDirectionalLight } from "../SceneSetup";
import { gltfObjectToTiles } from "../../src/utils";
import { WFCGenerator } from "../../src/generators/WFCGenerator";

/**
 * Load tiles from GLB folder with embedded adjacency data
 */

async function loadTilesFromGLBFolder(): Promise<ModelTile3DConfig[]> {
  // Use import.meta.glob to discover all GLB files
  // console.log(`${folderPath}/*.glb`);
  // let path = `${folderPath}/*.glb`;
  const glbModules = import.meta.glob("/public/models/blocksez/*.glb", {
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

      // Convert GLTF scene to tiles using utility function
      const tileMeshes = gltfObjectToTiles(gltf.scene, {
        idPrefix: filenameWithoutExt,
        baseRotation: new THREE.Euler(Math.PI / 2, 0, 0),
        recursive: true,
        doubleSided: true,
      });

      // Count tiles with adjacencies
      tileMeshes.forEach((tile) => {
        const hasAdjacencies = Object.keys(tile.adjacency || {}).length > 0;
        if (hasAdjacencies) tilesWithAdjacencies++;
      });

      tiles.push(...tileMeshes);
    } catch (error) {
      console.error(`  ✗ Error loading ${path}:`, error);
    }
  }

  console.log(
    `\n📦 Loaded ${tiles.length} tiles (${tilesWithAdjacencies} with adjacency data)\n`
  );

  return tiles;
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
    const tiles = await loadTilesFromGLBFolder();

    const { scene, lights } = createScene({
      backgroundColor: 0xff0000,
      fog: false,
      fogColor: 0x1a1a2e,
      fogNear: 15,
      fogFar: 40,
      cameraPosition: { x: 15, y: 12, z: 15 },
      enableShadows: true,
      maxPolarAngle: Math.PI / 2,
    });

    const config = {
      scene,
      maxRetries: 3,
      autoExpansion: true,
      useWorkers: true,
      workerCount: navigator.hardwareConcurrency || 4,
      seed: Date.now(),
      cellSize: 2,
      width: 10,
      height: 3,
      depth: 10,
      debug: true,
    };

    const generator = new WFCGenerator(tiles, config);
    generator.onComplete("update-lighting", () => {
      updateDirectionalLight(scene, lights.directionalLight);
    });
    // generator.collapse({
    //   offset: {
    //     x: (-config.width * config.cellSize) / 2,
    //     y: (-config.height * config.cellSize) / 2,
    //     z: (-config.depth * config.cellSize) / 2,
    //   },
    // });
  } catch (error) {
    console.error("❌ Error initializing demo:", error);
    alert("Error loading demo. Check console for details.");
  }
})();
