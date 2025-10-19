export {
  validateTileAdjacency,
  prepareTilesForWorker,
  createAirTile,
  createBoxTile,
  createSphereTile,
  createCylinderTile,
  gltfObjectToTiles,
  type GLTFToTilesOptions,
} from "./TileHelpers";

export { WorkerPool, type WorkerTask, type WorkerResponse } from "./WorkerPool";

export {
  splitGridIntoRegions,
  getBoundaryCells,
  type Region3D,
} from "./RegionSplitter";

export {
  generateWithWorkers,
  type TileUpdateCallback,
} from "./MultiWorkerGenerator";

export {
  validateTileset,
  getCompatibilityMatrix,
  suggestFixes,
  type ValidationIssue,
  type ValidationResult,
} from "./TilesetValidator";

export { DebugUI, type DebugUIElements, type TileTransform } from "./debugUI";

export { DebugGrid } from "./DebugGrid";

export {
  createTilesetEditor,
  type TileTransformCallback,
  type TilesetEditorConfig,
  type TilesetEditorElements,
} from "./TilesetEditor";

export {
  AdjacencyBuilderUI,
  type AdjacencyBuilderConfig,
  type TilePair,
  type AdjacencyData,
  type TileData,
} from "./AdjacencyBuilderUI";
