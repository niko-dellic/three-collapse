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

export { generateWithWorkers } from "./MultiWorkerGenerator";

export {
  validateTileset,
  getCompatibilityMatrix,
  suggestFixes,
  type ValidationIssue,
  type ValidationResult,
} from "./TilesetValidator";
