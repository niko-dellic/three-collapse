/**
 * three-collapse - 3D Wave Function Collapse implementation with Three.js
 * @packageDocumentation
 */

// Main Generator (Primary Entry Point)
export {
  WFCGenerator,
  type WFCGeneratorOptions,
  type GenerateOptions,
  type ExpandOptions,
} from "./generators";

// Core WFC System
export {
  WFCTile3D,
  WFC3D,
  WFC3DBuffer,
  type ModelTile3DConfig,
  type WFC3DOptions,
  type WFC3DError,
  type SerializedBuffer,
  type SerializedCell,
} from "./wfc3d";

// GLB Loaders
export {
  GLBTileLoader,
  GLBAdjacencyLoader,
  type LoadedModelData,
  type GLBAdjacencyData,
} from "./loaders";

// Renderers
export { InstancedModelRenderer, type TileInstance } from "./renderers";

// Utilities
export {
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
  DebugGrid,
  AdjacencyBuilderUI,
  ConnectorBuilderUI,
  DebugUI,
  pickDirectory,
  loadGLBFilesFromDirectory,
  parseGLBFiles,
  exportSceneToGLB,
  saveGLBToFileHandle,
  downloadGLB,
  downloadJSON,
  type WorkerTask,
  type WorkerResponse,
  type Region3D,
  type TileUpdateCallback,
  type ValidationIssue,
  type ValidationResult,
  type AdjacencyBuilderConfig,
  type TilePair,
  type AdjacencyData,
  type TileData,
  type TileTransform,
  type ConnectorBuilderConfig,
  type ConnectorData,
  type TileConnectors,
  type DirectionalExclusion,
  type ConnectorTile,
  type LoadedGLBFile,
} from "./utils";
