import * as THREE from "three";
import { type ModelTile3DConfig } from "../../../src/wfc3d";
import {
  createAirTile,
  createBoxTile,
  createCylinderTile,
  createSphereTile,
  validateTileAdjacency,
} from "../../../src/utils";
import { createPlaneTile } from "../../../src/utils/TileHelpers";

/**
 * Model-based tileset using GLB files
 *
 * This example uses free modular building assets.
 * You can download similar assets from:
 * - Kenney.nl (https://kenney.nl/assets)
 * - Quaternius (https://quaternius.com/)
 * - Poly Pizza (https://poly.pizza/)
 *
 * For this demo, we're using simplified path references.
 * Make sure to place your GLB files in the public/models/ directory.
 */
export const modelTileset: ModelTile3DConfig[] = [
  // Floor tile - can connect to any tile above or on sides
  {
    id: "floor",
    weight: 3,
    model: "/models/floor.glb",
    adjacency: {
      up: ["air", "wall", "corner", "floor"],
      down: ["floor", "foundation"],
      north: ["floor", "wall", "corner", "air"],
      south: ["floor", "wall", "corner", "air"],
      east: ["floor", "wall", "corner", "air"],
      west: ["floor", "wall", "corner", "air"],
    },
  },

  // Wall tile - vertical connector
  {
    id: "wall",
    weight: 2,
    model: "/models/wall.glb",
    adjacency: {
      up: ["wall", "roof", "air"],
      down: ["wall", "floor", "foundation"],
      north: ["air", "floor"],
      south: ["air", "floor"],
      east: ["air", "floor"],
      west: ["air", "floor"],
    },
  },

  // Corner piece - for wall intersections
  {
    id: "corner",
    weight: 1,
    model: "/models/corner.glb",
    adjacency: {
      up: ["corner", "roof", "air"],
      down: ["corner", "floor", "foundation"],
      north: ["wall", "air", "floor"],
      south: ["wall", "air", "floor"],
      east: ["wall", "air", "floor"],
      west: ["wall", "air", "floor"],
    },
  },

  // Foundation - bottom support
  {
    id: "foundation",
    weight: 2,
    model: "/models/foundation.glb",
    adjacency: {
      up: ["floor", "wall", "corner"],
      down: ["foundation"],
      north: ["foundation", "air"],
      south: ["foundation", "air"],
      east: ["foundation", "air"],
      west: ["foundation", "air"],
    },
  },

  // Roof tile - top covering
  {
    id: "roof",
    weight: 2,
    model: "/models/roof.glb",
    adjacency: {
      up: ["air"],
      down: ["wall", "corner"],
      north: ["roof", "air"],
      south: ["roof", "air"],
      east: ["roof", "air"],
      west: ["roof", "air"],
    },
  },

  // Air - empty space
  {
    id: "air",
    weight: 10,
    model: "/models/empty.glb", // Placeholder, won't be rendered
    adjacency: {
      up: ["air", "roof"],
      down: ["air", "floor", "foundation"],
      north: ["air", "wall", "corner", "roof", "floor"],
      south: ["air", "wall", "corner", "roof", "floor"],
      east: ["air", "wall", "corner", "roof", "floor"],
      west: ["air", "wall", "corner", "roof", "floor"],
    },
  },
];

/**
 * Simplified tileset for easier testing with fewer constraints
 * Note: This tileset is validated to ensure all adjacency references exist
 */
const simpleModelTilesetRaw: ModelTile3DConfig[] = [
  {
    id: "block",
    weight: 2,
    model: "/models/block.glb",
    adjacency: {
      up: ["block", "air"],
      down: ["block", "base"],
      north: ["block", "air"],
      south: ["block", "air"],
      east: ["block", "air"],
      west: ["block", "air"],
    },
  },
  {
    id: "base",
    weight: 3,
    model: "/models/base.glb",
    adjacency: {
      up: ["block", "base"],
      down: ["base"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "air",
    weight: 8,
    model: createAirTile, // Use helper for minimal geometry
    adjacency: {
      up: ["air"],
      down: ["air", "block", "base"],
      north: ["air", "block", "base"],
      south: ["air", "block", "base"],
      east: ["air", "block", "base"],
      west: ["air", "block", "base"],
    },
  },
];

// Validate and export the tileset (removes invalid adjacency references)
export const simpleModelTileset = validateTileAdjacency(simpleModelTilesetRaw);

/**
 * Mixed tileset demonstrating both GLB models and procedural geometry
 * This example shows how you can combine imported models with Three.js geometry
 */

const silverMaterial = new THREE.MeshMatcapMaterial({
  matcap: new THREE.TextureLoader().load("./image/silver.png"),
  side: THREE.DoubleSide,
});

const purpleMaterial = new THREE.MeshStandardMaterial({
  color: 0x800080, // Purple
  side: THREE.DoubleSide,
});

const mixedModelTilesetRaw: ModelTile3DConfig[] = [
  {
    id: "base",
    weight: 7,
    model: () => createPlaneTile(purpleMaterial),
    adjacency: {
      up: ["air"],
      down: ["cube", "cylinder", "base"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "cube",
    weight: 1,
    // Use helper function for simple box tile
    model: () => createBoxTile(silverMaterial, 1.25),
    adjacency: {
      up: ["cube", "sphere", "air"],
      down: ["cube", "base", "cylinder"],
      north: ["cube", "sphere", "air", "block"],
      south: ["cube", "sphere", "air", "block"],
      east: ["cube", "sphere", "air", "block"],
      west: ["cube", "sphere", "air", "block"],
    },
  },
  {
    id: "cylinder",
    weight: 5,
    model: () => createCylinderTile(silverMaterial),
    adjacency: {
      up: ["cylinder", "cube", "air", "sphere", "cylinder"],
      down: ["cylinder", "cube", "base", "block"],
      north: ["cylinder", "cube", "air", "block"],
      south: ["cylinder", "cube", "air", "block", "cylinder"],
      east: ["cylinder", "cube", "air", "block", "cylinder"],
      west: ["cylinder", "cube", "air", "block", "cylinder"],
    },
  },
  {
    id: "sphere",
    weight: 1,
    // Use helper function for simple sphere tile
    model: () =>
      createSphereTile(
        new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.66 })
      ),
    adjacency: {
      up: ["sphere", "cube", "air"],
      down: ["block", "cube", "base", "cylinder"],
      north: ["sphere", "air", "cube", "cylinder"],
      south: ["sphere", "air", "cube", "cylinder"],
      east: ["sphere", "air", "cube"],
      west: ["sphere", "air", "cube", "cylinder"],
    },
  },
  {
    id: "air",
    weight: 8,
    // Use helper function for minimal air tile
    model: createAirTile,
    adjacency: {
      up: ["air", "cube"],
      down: ["air", "block", "base", "cube", "sphere", "cylinder"],
      north: ["air", "block", "base", "cube", "sphere", "cylinder"],
      south: ["air", "block", "base", "cube", "sphere", "cylinder"],
      east: ["air", "block", "base", "cube", "sphere", "cylinder"],
      west: ["air", "block", "base", "cube", "sphere", "cylinder"],
    },
  },
];

// Validate and export the tileset (removes invalid adjacency references)
export const mixedModelTileset = validateTileAdjacency(mixedModelTilesetRaw);
