import { type ModelTile3DConfig } from "../../../src/wfc3d";
import {
  createBoxTile,
  createSphereTile,
  createAirTile,
  validateTileAdjacency,
} from "../../../src/utils";

/**
 * Example demonstrating tile adjacency validation
 *
 * This shows what happens when you remove a tile but forget to update
 * adjacency references in other tiles.
 */

// Original tileset with 4 tiles
const originalTileset: ModelTile3DConfig[] = [
  {
    id: "base",
    weight: 3,
    model: () => createBoxTile(), // Brown base
    adjacency: {
      up: ["wall", "pillar", "air"],
      down: ["base"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "wall",
    weight: 2,
    model: () => createBoxTile(), // Gray wall
    adjacency: {
      up: ["wall", "roof", "air"],
      down: ["base", "pillar"],
      north: ["wall", "air"],
      south: ["wall", "air"],
      east: ["wall", "air"],
      west: ["wall", "air"],
    },
  },
  {
    id: "pillar",
    weight: 1,
    model: () => createBoxTile(), // Sienna pillar
    adjacency: {
      up: ["pillar", "roof", "air"],
      down: ["base"],
      north: ["wall", "air"],
      south: ["wall", "air"],
      east: ["wall", "air"],
      west: ["wall", "air"],
    },
  },
  {
    id: "air",
    weight: 5,
    model: createAirTile,
    adjacency: {
      up: ["air"],
      down: ["air", "wall", "pillar", "base"],
      north: ["air", "wall", "pillar", "base"],
      south: ["air", "wall", "pillar", "base"],
      east: ["air", "wall", "pillar", "base"],
      west: ["air", "wall", "pillar", "base"],
    },
  },
];

// Now let's say we want to remove "pillar" from our tileset
const tilesetWithoutPillar: ModelTile3DConfig[] = [
  {
    id: "base",
    weight: 3,
    model: () => createBoxTile(),
    adjacency: {
      up: ["wall", "pillar", "air"], // ❌ Still references "pillar"!
      down: ["base"],
      north: ["base", "air"],
      south: ["base", "air"],
      east: ["base", "air"],
      west: ["base", "air"],
    },
  },
  {
    id: "wall",
    weight: 2,
    model: () => createBoxTile(),
    adjacency: {
      up: ["wall", "roof", "air"], // ❌ References "roof" which doesn't exist!
      down: ["base", "pillar"], // ❌ Still references "pillar"!
      north: ["wall", "air"],
      south: ["wall", "air"],
      east: ["wall", "air"],
      west: ["wall", "air"],
    },
  },
  {
    id: "air",
    weight: 5,
    model: createAirTile,
    adjacency: {
      up: ["air"],
      down: ["air", "wall", "pillar", "base"], // ❌ Still references "pillar"!
      north: ["air", "wall", "pillar", "base"], // ❌ Still references "pillar"!
      south: ["air", "wall", "pillar", "base"], // ❌ Still references "pillar"!
      east: ["air", "wall", "pillar", "base"], // ❌ Still references "pillar"!
      west: ["air", "wall", "pillar", "base"], // ❌ Still references "pillar"!
    },
  },
  // Note: "pillar" tile is removed!
];

// ✅ Use validateTileAdjacency to automatically clean up invalid references
const validatedTileset = validateTileAdjacency(tilesetWithoutPillar);

/**
 * After validation, the tileset will have:
 *
 * base.adjacency.up = ["wall", "air"]  // "pillar" removed
 * wall.adjacency.up = ["wall", "air"]  // "roof" removed
 * wall.adjacency.down = ["base"]       // "pillar" removed
 * air.adjacency.down = ["air", "wall", "base"]  // "pillar" removed
 * air.adjacency.north/south/east/west = ["air", "wall", "base"]  // "pillar" removed
 *
 * Console will show warnings for each removed reference:
 * - Tile "base" references non-existent tile "pillar" in up adjacency. Removing reference.
 * - Tile "wall" references non-existent tile "roof" in up adjacency. Removing reference.
 * - Tile "wall" references non-existent tile "pillar" in down adjacency. Removing reference.
 * - Tile "air" references non-existent tile "pillar" in down adjacency. Removing reference.
 * - etc...
 */

export { originalTileset, tilesetWithoutPillar, validatedTileset };
