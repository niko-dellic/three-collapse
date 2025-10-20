import * as THREE from "three";
import { type ModelTile3DConfig } from "../../../src/wfc3d";
import {
  createAirTile,
  createBoxTile,
  createCylinderTile,
  convertAdjacencyToConnectors,
} from "../../../src/utils";
import { createPlaneTile } from "../../../src/utils/TileHelpers";

/**
 * Example tilesets demonstrating both legacy adjacency and new connector systems
 *
 * The raw tilesets use the old adjacency format and are converted to connector-based
 * configs using the convertAdjacencyToConnectors helper. This provides backward
 * compatibility while allowing use with the new WFC system.
 *
 * For production use, it's recommended to use ConnectorBuilderUI to create
 * proper connector-based tilesets with fine-grained control over symmetry and rotation.
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

// Export both raw (legacy) and converted (connector-based) versions
export const simpleModelTilesetRaw_Legacy = simpleModelTilesetRaw;
export const simpleModelTileset = convertAdjacencyToConnectors(
  simpleModelTilesetRaw
);

/**
 * Mixed tileset demonstrating both GLB models and procedural geometry
 * This example shows how you can combine imported models with Three.js geometry
 */

const silverMaterial = new THREE.MeshMatcapMaterial({
  matcap: new THREE.TextureLoader().load("./image/silver.png"),
  side: THREE.DoubleSide,
});

const mixedModelTilesetRaw: ModelTile3DConfig[] = [
  {
    id: "base",
    weight: 10,
    model: () => createPlaneTile(silverMaterial),
    adjacency: {
      up: ["air"],
      down: ["cube", "cylinder", "air"],
      north: ["base", "air", "quater-pipe", "quater-pipe-straight"],
      south: ["base", "air", "quater-pipe", "quater-pipe-straight", "halfpipe"],
      east: ["base", "air", "quater-pipe", "quater-pipe-straight", "halfpipe"],
      west: ["base", "air", "quater-pipe", "quater-pipe-straight", "halfpipe"],
    },
    scale: 2,
  },

  // {
  //   id: "ramp",
  //   weight: 20,
  //   model: "./models/ramp.glb",
  //   material: silverMaterial,
  //   adjacency: {},
  // },
  {
    id: "halfpipe",
    weight: 20,
    model: "./models/halfpipe.glb",
    material: silverMaterial,
    adjacency: {},
  },
  // {
  //   id: "bend",
  //   weight: 20,
  //   model: "./models/bend.glb",
  //   material: silverMaterial,
  //   adjacency: {},
  // },
  {
    id: "quater-pipe",
    weight: 5,
    model: "./models/quaterpipe.glb",
    material: silverMaterial,
    adjacency: {},
    scale: { x: 1, y: 1, z: 1 },
  },
  {
    id: "quater-pipe-straight",
    weight: 5,
    model: "./models/quaterpipe-straight.glb",
    material: silverMaterial,
    adjacency: {
      northEx: ["quater-pipe", "quater-pipe-straight"],
      southEx: ["quater-pipe", "quater-pipe-straight"],
    },
    scale: { x: 1, y: 1, z: 1 },
  },
  {
    id: "bump",
    weight: 3,
    model: "./models/bump.glb",
    material: silverMaterial,
    adjacency: {},
    scale: 2,
  },
  {
    id: "cube",
    weight: 2,
    // Use helper function for simple box tile
    model: () => createBoxTile(silverMaterial, 0.75),
    adjacency: {},
  },
  {
    id: "cylinder",
    weight: 2,
    model: () => createCylinderTile(silverMaterial),
    adjacency: {},
    scale: { x: 1, y: 3, z: 1 },
  },
  // {
  //   id: "sphere",
  //   weight: 2,
  //   // Use helper function for simple sphere tile
  //   model: () =>
  //     createSphereTile(
  //       new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.66 })
  //     ),
  //   adjacency: {},
  // },
  {
    id: "air",
    weight: 20,
    // Use helper function for minimal air tile
    model: createAirTile,
    adjacency: {
      northEx: ["quater-pipe", "quater-pipe-straight"],
      southEx: ["quater-pipe", "quater-pipe-straight"],
      // up: ["air", "base", "cube", "sphere"],
      // down: ["air", "base", "cube", "sphere"],
    },
  },
];

// Export both raw (legacy) and converted (connector-based) versions
export const mixedModelTilesetRaw_Legacy = mixedModelTilesetRaw;
export const mixedModelTileset =
  convertAdjacencyToConnectors(mixedModelTilesetRaw);

// @ts-ignore
const invertY = { x: -1, y: 1, z: 1 };

const blockTilesetRaw: ModelTile3DConfig[] = [
  {
    id: "handrail-entrance",
    weight: 1,
    model: "./models/blocks/handrail-entrance.glb",
    material: silverMaterial,
    adjacency: {},
  },
  {
    id: "corner-inverted",
    weight: 1,
    model: "./models/blocks/corner-inverted.glb",
    material: silverMaterial,
    adjacency: {},
  },
  {
    id: "spiral-staircase",
    weight: 1,
    model: "./models/blocks/spiral-staircase.glb",
    material: silverMaterial,
    adjacency: {
      allEx: ["spiral-staircase"],
      west: ["spiral-staircase-inverted"],
      up: ["air"],
    },
  },
  {
    id: "spiral-staircase-inverted",
    weight: 1,
    model: "./models/blocks/spiral-staircase.glb",
    material: silverMaterial,
    adjacency: {
      allEx: ["spiral-staircase-inverted"],
      east: ["spiral-staircase"],
      up: ["air"],
    },
    scale: invertY,
  },
  {
    id: "square-roof",
    weight: 1,
    model: "./models/blocks/square-roof.glb",
    material: silverMaterial,
    adjacency: {
      allEx: ["square-roof"],
      down: ["air"],
    },
  },
  // {
  //   id: "clock-corner",
  //   weight: 1,
  //   model: "./models/blocks/clock-corner.glb",
  //   material: silverMaterial,
  //   adjacency: {
  //     allEx: ["clock-corner"],
  //     up: ["ceiling-corner"],
  //   },
  // },
  // {
  //   id: "ceiling-corner",
  //   weight: 1,
  //   model: "./models/blocks/ceiling-corner.glb",
  //   material: silverMaterial,
  //   adjacency: {
  //     allEx: ["ceiling-corner"],
  //     down: ["clock-corner"],
  //   },
  // },
  // {
  //   id: "staircase-entrance",
  //   weight: 1,
  //   model: "./models/blocks/column-entrance.glb",
  //   material: silverMaterial,
  //   adjacency: {
  //     allEx: ["spiral-staircase-entrance"],
  //     south: ["spiral-staircase", "staircase-entrance"],
  //   },
  // },

  // {
  //   id: "air",
  //   weight: 3,
  //   model: createAirTile,
  //   adjacency: {},
  // },
];

// Export both raw (legacy) and converted (connector-based) versions
export const blockTilesetRaw_Legacy = blockTilesetRaw;
export const blockTileset = convertAdjacencyToConnectors(blockTilesetRaw);
