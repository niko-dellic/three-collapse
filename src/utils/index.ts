export {
  validateTileExclusions,
  prepareTilesForWorker,
  createAirTile,
  createBoxTile,
  createSphereTile,
  createCylinderTile,
  gltfObjectToTiles,
  type GLTFToTilesOptions,
} from "./TileHelpers";

export {
  convertAdjacencyToConnectors,
  needsConnectorConversion,
} from "./AdjacencyConverter";

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

export { DebugUI } from "./debugUI";
export { type TileTransform } from "./TilesetEditor";

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

export {
  ConnectorBuilderUI,
  type ConnectorBuilderConfig,
  type ConnectorData,
  type TileConnectors,
  type DirectionalExclusion,
  type ConnectorTile,
} from "./ConnectorBuilderUI";

export {
  pickDirectory,
  loadGLBFilesFromDirectory,
  parseGLBFiles,
  exportSceneToGLB,
  saveGLBToFileHandle,
  downloadGLB,
  downloadJSON,
  type LoadedGLBFile,
} from "./GLBFileUtils";
