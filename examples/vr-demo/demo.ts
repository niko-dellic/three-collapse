/**
 * VR WFC Demo - Interactive procedural generation in VR
 *
 * This demo allows users to create and delete WFC cells in VR using controllers:
 * - Right controller: Create/expand cells (green preview)
 * - Left controller: Delete cells (red preview)
 * - Grip button: Toggle between edit and locomotion modes
 * - In locomotion mode: teleport using right controller
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import { gltfObjectToTiles } from "../../src/utils";
import { WFCGenerator } from "../../src/generators/WFCGenerator";
import { createVRScene, createReferenceMarkers } from "./VRSceneSetup";
import { VRControllerManager } from "./VRControllerManager";

const cellSize = 0.05;

/**
 * Load tiles from GLB folder with embedded adjacency data
 */

async function loadTilesFromGLBFolder(): Promise<ModelTile3DConfig[]> {
  const glbModules = import.meta.glob("/public/models/blocksez/*.glb", {
    eager: false,
    query: "?url",
    import: "default",
  });

  const loader = new GLTFLoader();
  const tiles: ModelTile3DConfig[] = [];
  let tilesWithAdjacencies = 0;

  console.log("Loading tileset...");

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

      // Convert GLTF scene to tiles
      const tileMeshes = gltfObjectToTiles(gltf.scene, {
        idPrefix: filenameWithoutExt,
        baseRotation: new THREE.Euler(Math.PI / 2, 0, 0),
        baseScale: new THREE.Vector3(cellSize, cellSize, cellSize),
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
      console.error(`Error loading ${path}:`, error);
    }
  }

  console.log(
    `Loaded ${tiles.length} tiles (${tilesWithAdjacencies} with adjacency data)`
  );

  return tiles;
}

// Initialize VR demo
(async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              VR WFC Demo - Interactive Generation             ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Use VR controllers to build procedural structures:          ║
║                                                               ║
║  Right Controller (Green): Create cells                       ║
║  Left Controller (Red): Delete cells                          ║
║  Grip Button: Toggle edit/locomotion mode                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  try {
    // Load tiles
    const tiles = await loadTilesFromGLBFolder();

    if (tiles.length === 0) {
      throw new Error("No tiles loaded! Check the tileset path.");
    }

    // Create VR scene
    const { scene, camera, renderer } = createVRScene({
      backgroundColor: 0x1a1a2e,
      enableShadows: true,
      groundPlaneSize: 100,
      gridSize: 100,
      ambientIntensity: 0.5,
      directionalIntensity: 0.8,
    });

    // Add reference markers
    createReferenceMarkers(scene);

    // Configuration
    const config = {
      scene,
      maxRetries: 3,
      autoExpansion: true,
      workerCount: navigator.hardwareConcurrency || 4,
      seed: Date.now(),
      cellSize: cellSize,
      width: 5,
      height: 3,
      depth: 5,
      debug: false, // Disable debug UI in VR
    };

    // Create WFC generator
    const generator = new WFCGenerator(tiles, config);
    console.log("WFC Generator initialized");

    // Track VR rig position for teleportation
    const dolly = new THREE.Group();
    dolly.position.set(0, 0, 0);
    dolly.add(camera);
    scene.add(dolly);

    // Create controller manager
    const controllerManager = new VRControllerManager(
      scene,
      renderer,
      camera,
      config.cellSize,
      {
        // Create cells callback
        onRightTrigger: async (cellX, cellY, cellZ, sizeX, sizeY, sizeZ) => {
          console.log(
            `Creating cells at (${cellX}, ${cellY}, ${cellZ}) with size ${sizeX}x${sizeY}x${sizeZ}`
          );
          controllerManager.setGenerating(true);

          try {
            await generator.expandFromCell(
              cellX,
              cellY,
              cellZ,
              sizeX,
              sizeY,
              sizeZ
            );
            console.log("Cell expansion complete");
          } catch (error) {
            console.error("Error expanding cells:", error);
          } finally {
            controllerManager.setGenerating(false);
          }
        },

        // Delete cells callback
        onLeftTrigger: async (cellX, cellY, cellZ, sizeX, sizeY, sizeZ) => {
          console.log(
            `Deleting cells at (${cellX}, ${cellY}, ${cellZ}) with size ${sizeX}x${sizeY}x${sizeZ}`
          );
          controllerManager.setGenerating(true);

          try {
            await generator.deleteFromCell(
              cellX,
              cellY,
              cellZ,
              sizeX,
              sizeY,
              sizeZ
            );
            console.log("Cell deletion complete");
          } catch (error) {
            console.error("Error deleting cells:", error);
          } finally {
            controllerManager.setGenerating(false);
          }
        },

        // Teleport callback
        onTeleport: (position) => {
          console.log(
            `Teleporting to (${position.x}, ${position.y}, ${position.z})`
          );
          dolly.position.copy(position);
        },
      }
    );

    console.log("Controller manager initialized");

    // Animation loop
    renderer.setAnimationLoop(() => {
      // Update controller manager
      controllerManager.update();

      // Render scene
      renderer.render(scene, camera);
    });

    console.log("VR demo ready! Put on your headset and click 'Enter VR'");

    // Update info panel when entering/exiting VR
    renderer.xr.addEventListener("sessionstart", () => {
      console.log("VR session started");
      const infoPanel = document.getElementById("vr-info");
      if (infoPanel) {
        infoPanel.style.display = "none";
      }
    });

    renderer.xr.addEventListener("sessionend", () => {
      console.log("VR session ended");
      const infoPanel = document.getElementById("vr-info");
      if (infoPanel) {
        infoPanel.style.display = "block";
      }
    });

    // Handle keyboard input for testing in non-VR mode
    window.addEventListener("keydown", (event) => {
      if (!renderer.xr.isPresenting) {
        // Only in non-VR mode
        const size = controllerManager.getRightSize();

        switch (event.key) {
          case "e":
            // Test expand at origin
            console.log("Testing expand at origin...");
            generator
              .expandFromCell(0, 0, 0, size.x, size.y, size.z)
              .catch(console.error);
            break;
          case "d":
            // Test delete at origin
            console.log("Testing delete at origin...");
            generator
              .deleteFromCell(0, 0, 0, size.x, size.y, size.z)
              .catch(console.error);
            break;
          case "m":
            // Toggle mode
            controllerManager.toggleMode();
            break;
          case "ArrowUp":
            controllerManager.adjustSize("right", "y", 1);
            break;
          case "ArrowDown":
            controllerManager.adjustSize("right", "y", -1);
            break;
          case "ArrowRight":
            controllerManager.adjustSize("right", "x", 1);
            break;
          case "ArrowLeft":
            controllerManager.adjustSize("right", "x", -1);
            break;
          case "PageUp":
            controllerManager.adjustSize("right", "z", 1);
            break;
          case "PageDown":
            controllerManager.adjustSize("right", "z", -1);
            break;
        }
      }
    });

    console.log("\nKeyboard shortcuts (non-VR testing):");
    console.log("  E: Expand at origin");
    console.log("  D: Delete at origin");
    console.log("  M: Toggle mode");
    console.log("  Arrow keys: Adjust X/Y size");
    console.log("  Page Up/Down: Adjust Z size");
  } catch (error) {
    console.error("Error initializing VR demo:", error);
  }
})();
