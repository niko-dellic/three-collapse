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
  createDemoUI,
  showProgress,
  hideProgress,
  setProgress,
  setProgressColor,
  type DemoUIConfig,
  type DemoUIElements,
} from "./DemoUI";

export { DebugGrid } from "./DebugGrid";

export {
  createTilesetEditor,
  type TileTransform,
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
