import GUI from "lil-gui";
import * as THREE from "three";
import type { BaseTile3DConfig } from "../wfc3d/WFCTile3D";

/**
 * Per-tile transform overrides
 */
export interface TileTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // In radians
  scale: { x: number; y: number; z: number };
}

/**
 * Callback for when tile transforms change
 */
export type TileTransformCallback = (
  tileId: string,
  transform: TileTransform
) => void;

/**
 * Configuration for tileset editor
 */
export interface TilesetEditorConfig {
  tiles: BaseTile3DConfig[];
  onTransformChange: TileTransformCallback;
  initialTransforms?: Map<string, TileTransform>;
  parentGUI?: GUI;
}

/**
 * UI elements for the tileset editor
 */
export interface TilesetEditorElements {
  folder: GUI;
  tileControllers: Map<string, TileEditorControllers>;
}

/**
 * Controllers for a single tile
 */
interface TileEditorControllers {
  folder: GUI;
  position: { x: any; y: any; z: any };
  rotation: { x: any; y: any; z: any };
  uniformScale: any;
  scale: { x: any; y: any; z: any };
}

/**
 * Creates a tileset editor UI with transform controls for each tile
 */
export function createTilesetEditor(
  config: TilesetEditorConfig
): TilesetEditorElements {
  const gui = config.parentGUI || new GUI();
  const folder = gui.addFolder("Tileset Editor");

  const tileControllers = new Map<string, TileEditorControllers>();

  // Create editor for each tile
  for (const tile of config.tiles) {
    const controllers = createTileEditor(tile, config, folder);
    tileControllers.set(tile.id, controllers);
  }

  folder.close(); // Start collapsed to save space

  return {
    folder,
    tileControllers,
  };
}

/**
 * Creates an editor for a single tile
 */
function createTileEditor(
  tile: BaseTile3DConfig,
  config: TilesetEditorConfig,
  parentFolder: GUI
): TileEditorControllers {
  // Get initial transform
  const initialTransform =
    config.initialTransforms?.get(tile.id) || getDefaultTransform(tile);

  // Create a folder for this tile
  const tileFolder = parentFolder.addFolder(tile.id);

  // Create a params object for lil-gui to bind to
  const params = {
    position: {
      x: initialTransform.position.x,
      y: initialTransform.position.y,
      z: initialTransform.position.z,
    },
    rotation: {
      x: THREE.MathUtils.radToDeg(initialTransform.rotation.x),
      y: THREE.MathUtils.radToDeg(initialTransform.rotation.y),
      z: THREE.MathUtils.radToDeg(initialTransform.rotation.z),
    },
    scale: {
      uniform: initialTransform.scale.x, // Assume uniform initially
      x: initialTransform.scale.x,
      y: initialTransform.scale.y,
      z: initialTransform.scale.z,
    },
    reset: () => {
      const defaultTransform = getDefaultTransform(tile);

      // Update params
      params.position.x = defaultTransform.position.x;
      params.position.y = defaultTransform.position.y;
      params.position.z = defaultTransform.position.z;
      params.rotation.x = THREE.MathUtils.radToDeg(defaultTransform.rotation.x);
      params.rotation.y = THREE.MathUtils.radToDeg(defaultTransform.rotation.y);
      params.rotation.z = THREE.MathUtils.radToDeg(defaultTransform.rotation.z);
      params.scale.uniform = defaultTransform.scale.x;
      params.scale.x = defaultTransform.scale.x;
      params.scale.y = defaultTransform.scale.y;
      params.scale.z = defaultTransform.scale.z;

      // Update display
      Object.values(controllers.position).forEach((c) => c.updateDisplay());
      Object.values(controllers.rotation).forEach((c) => c.updateDisplay());
      controllers.uniformScale.updateDisplay();
      Object.values(controllers.scale).forEach((c) => c.updateDisplay());

      // Trigger callback
      notifyChange();
    },
  };

  // Callback to notify of changes
  const notifyChange = () => {
    config.onTransformChange(tile.id, {
      position: params.position,
      rotation: {
        x: THREE.MathUtils.degToRad(params.rotation.x),
        y: THREE.MathUtils.degToRad(params.rotation.y),
        z: THREE.MathUtils.degToRad(params.rotation.z),
      },
      scale: params.scale,
    });
  };

  // Position folder
  const posFolder = tileFolder.addFolder("Position");
  const posControllers = {
    x: posFolder.add(params.position, "x", -5, 5, 0.1).onChange(notifyChange),
    y: posFolder.add(params.position, "y", -5, 5, 0.1).onChange(notifyChange),
    z: posFolder.add(params.position, "z", -5, 5, 0.1).onChange(notifyChange),
  };
  posFolder.close();

  // Rotation folder (in degrees for better UX)
  const rotFolder = tileFolder.addFolder("Rotation (deg)");
  const rotControllers = {
    x: rotFolder.add(params.rotation, "x", -180, 180, 5).onChange(notifyChange),
    y: rotFolder.add(params.rotation, "y", -180, 180, 5).onChange(notifyChange),
    z: rotFolder.add(params.rotation, "z", -180, 180, 5).onChange(notifyChange),
  };
  rotFolder.close();

  // Scale folder
  const scaleFolder = tileFolder.addFolder("Scale");

  // Uniform scale controller (updates all axes)
  const uniformScaleController = scaleFolder
    .add(params.scale, "uniform", 0.1, 3, 0.1)
    .name("Uniform")
    .onChange((value: number) => {
      params.scale.x = value;
      params.scale.y = value;
      params.scale.z = value;
      scaleControllers.x.updateDisplay();
      scaleControllers.y.updateDisplay();
      scaleControllers.z.updateDisplay();
      notifyChange();
    });

  // Individual scale controllers
  const scaleControllers = {
    x: scaleFolder.add(params.scale, "x", 0.1, 3, 0.1).onChange(notifyChange),
    y: scaleFolder.add(params.scale, "y", 0.1, 3, 0.1).onChange(notifyChange),
    z: scaleFolder.add(params.scale, "z", 0.1, 3, 0.1).onChange(notifyChange),
  };
  scaleFolder.close();

  // Reset button
  tileFolder.add(params, "reset").name("Reset to Default");

  // Start with tile folder closed to save space
  tileFolder.close();

  const controllers: TileEditorControllers = {
    folder: tileFolder,
    position: posControllers,
    rotation: rotControllers,
    uniformScale: uniformScaleController,
    scale: scaleControllers,
  };

  return controllers;
}

/**
 * Gets the default transform from a tile config
 */
function getDefaultTransform(tile: BaseTile3DConfig): TileTransform {
  // Check if tile has model-specific transforms
  const modelTile = tile as any;

  let position = { x: 0, y: 0, z: 0 };
  let rotation = { x: 0, y: 0, z: 0 };
  let scale = { x: 1, y: 1, z: 1 };

  if (modelTile.position) {
    if (modelTile.position instanceof THREE.Vector3) {
      position = {
        x: modelTile.position.x,
        y: modelTile.position.y,
        z: modelTile.position.z,
      };
    } else {
      position = {
        x: modelTile.position.x ?? 0,
        y: modelTile.position.y ?? 0,
        z: modelTile.position.z ?? 0,
      };
    }
  }

  if (modelTile.rotation) {
    if (modelTile.rotation instanceof THREE.Euler) {
      rotation = {
        x: modelTile.rotation.x,
        y: modelTile.rotation.y,
        z: modelTile.rotation.z,
      };
    } else {
      rotation = {
        x: modelTile.rotation.x ?? 0,
        y: modelTile.rotation.y ?? 0,
        z: modelTile.rotation.z ?? 0,
      };
    }
  }

  if (modelTile.scale) {
    if (typeof modelTile.scale === "number") {
      scale = { x: modelTile.scale, y: modelTile.scale, z: modelTile.scale };
    } else if (modelTile.scale instanceof THREE.Vector3) {
      scale = {
        x: modelTile.scale.x,
        y: modelTile.scale.y,
        z: modelTile.scale.z,
      };
    } else {
      scale = {
        x: modelTile.scale.x ?? 1,
        y: modelTile.scale.y ?? 1,
        z: modelTile.scale.z ?? 1,
      };
    }
  }

  return { position, rotation, scale };
}
