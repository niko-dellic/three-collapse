/**
 * three-collapse - 3D Wave Function Collapse implementation with Three.js
 * @packageDocumentation
 */

// Core WFC System
export {
  WFCTile3D,
  WFC3D,
  WFC3DBuffer,
  type WFCTile3DConfig,
  type VoxelTile3DConfig,
  type ModelTile3DConfig,
  type BaseTile3DConfig,
  type WFC3DOptions,
  type WFC3DError,
  type SerializedBuffer,
  type SerializedCell,
} from "./wfc3d";

// GLB Loaders
export { GLBTileLoader, type LoadedModelData } from "./loaders";

// Renderers
export { InstancedModelRenderer, type TileInstance } from "./renderers";

// Utilities
export {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
  validateTileAdjacency,
  prepareTilesForWorker,
  createAirTile,
  createBoxTile,
  createSphereTile,
  createCylinderTile,
  WorkerPool,
  splitGridIntoRegions,
  getBoundaryCells,
  generateWithWorkers,
  validateTileset,
  getCompatibilityMatrix,
  suggestFixes,
  type SceneConfig,
  type LightConfig,
  type SceneSetupResult,
  type WorkerTask,
  type WorkerResponse,
  type Region3D,
  type ValidationIssue,
  type ValidationResult,
} from "./utils";
