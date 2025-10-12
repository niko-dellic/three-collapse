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
} from "./wfc3d";

// GLB Loaders
export { GLBTileLoader, type LoadedModelData } from "./loaders";

// Renderers
export { InstancedModelRenderer, type TileInstance } from "./renderers";
