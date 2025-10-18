export {
  createScene,
  addLighting,
  createResizeHandler,
  createAnimationLoop,
  type SceneConfig,
  type LightConfig,
  type SceneSetupResult,
} from "./SceneSetup";

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

export {
  DebugUI,
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
  type DebugUIConfig,
  type DemoUIConfig,
  type DemoUIElements,
  type DemoInstance,
  type TileTransform,
} from "./debugUI";

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
