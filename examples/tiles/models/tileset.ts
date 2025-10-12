import * as THREE from "three";
import { type ModelTile3DConfig } from "../../../src/wfc3d";
import {
  createAirTile,
  createBoxTile,
  createSphereTile,
} from "../../../src/utils";

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
 */
export const simpleModelTileset: ModelTile3DConfig[] = [
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

/**
 * Mixed tileset demonstrating both GLB models and procedural geometry
 * This example shows how you can combine imported models with Three.js geometry
 */
export const mixedModelTileset: ModelTile3DConfig[] = [
  {
    id: "block",
    weight: 2,
    model: "/models/block.glb", // Load from GLB file
    adjacency: {
      up: ["block", "air", "sphere"],
      down: ["block", "base", "cube"],
      north: ["block", "air", "sphere", "cube"],
      south: ["block", "air", "sphere", "cube"],
      east: ["block", "air", "sphere", "cube"],
      west: ["block", "air", "sphere", "cube"],
    },
  },
  {
    id: "base",
    weight: 3,
    model: "/models/base.glb", // Load from GLB file
    adjacency: {
      up: ["block", "base", "cube", "sphere"],
      down: ["base", "cube"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "cube",
    weight: 2,
    // Use helper function for simple box tile
    model: () => createBoxTile(0x4a90e2),
    adjacency: {
      up: ["cube", "sphere", "air"],
      down: ["cube", "base"],
      north: ["cube", "sphere", "air", "block"],
      south: ["cube", "sphere", "air", "block"],
      east: ["cube", "sphere", "air", "block"],
      west: ["cube", "sphere", "air", "block"],
    },
  },
  {
    id: "sphere",
    weight: 1,
    // Use helper function for simple sphere tile
    model: () => createSphereTile(0xe24a4a),
    adjacency: {
      up: ["sphere", "air"],
      down: ["block", "cube", "base"],
      north: ["sphere", "air", "cube"],
      south: ["sphere", "air", "cube"],
      east: ["sphere", "air", "cube"],
      west: ["sphere", "air", "cube"],
    },
  },
  {
    id: "air",
    weight: 8,
    // Use helper function for minimal air tile
    model: createAirTile,
    adjacency: {
      up: ["air"],
      down: ["air", "block", "base", "cube", "sphere"],
      north: ["air", "block", "base", "cube", "sphere"],
      south: ["air", "block", "base", "cube", "sphere"],
      east: ["air", "block", "base", "cube", "sphere"],
      west: ["air", "block", "base", "cube", "sphere"],
    },
  },
];
