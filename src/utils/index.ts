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
