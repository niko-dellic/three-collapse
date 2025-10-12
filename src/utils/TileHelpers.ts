import * as THREE from "three";
import type {
  BaseTile3DConfig,
  ModelTile3DConfig,
  VoxelTile3DConfig,
} from "../wfc3d";

/**
 * Helper functions for creating common tile geometries
 */

/**
 * Validates and cleans tile adjacency rules by removing references to non-existent tiles
 * This helps catch configuration errors where tiles reference IDs that don't exist
 *
 * @param tiles - Array of tile configurations to validate
 * @returns Array of tile configs with cleaned adjacency rules (only valid tile IDs)
 */
export function validateTileAdjacency<T extends BaseTile3DConfig>(
  tiles: T[]
): T[] {
  // Get set of all valid tile IDs
  const validIds = new Set(tiles.map((tile) => tile.id));

  // Filter adjacency rules to only include valid IDs
  return tiles.map((tile) => {
    if (!tile.adjacency) return tile;

    const cleanedAdjacency: typeof tile.adjacency = {};

    // Process each direction
    for (const [direction, ids] of Object.entries(tile.adjacency)) {
      if (Array.isArray(ids)) {
        // Filter out invalid IDs
        const validIdsForDirection = ids.filter((id) => {
          const isValid = validIds.has(id);
          if (!isValid) {
            console.warn(
              `Tile "${tile.id}" references non-existent tile "${id}" in ${direction} adjacency. Removing reference.`
            );
          }
          return isValid;
        });

        // Only include direction if it has valid IDs
        if (validIdsForDirection.length > 0) {
          cleanedAdjacency[direction as keyof typeof tile.adjacency] =
            validIdsForDirection;
        }
      }
    }

    return {
      ...tile,
      adjacency: cleanedAdjacency,
    };
  });
}

/**
 * Strips out the 'model' property from tile configs for sending to Web Workers
 * Web Workers can't receive functions, so we only send the metadata (id, weight, adjacency)
 *
 * @param tiles - Array of tile configurations
 * @returns Array of tile configs with only serializable properties
 */
export function prepareTilesForWorker<
  T extends ModelTile3DConfig | VoxelTile3DConfig
>(tiles: T[]): BaseTile3DConfig[] {
  return tiles.map(({ id, weight, adjacency }) => ({
    id,
    weight,
    adjacency,
  }));
}

/**
 * Creates a minimal "air" tile with a single point geometry
 * This is useful for empty space tiles that don't need to be rendered
 * but still need to exist in the tileset
 *
 * @returns A Mesh with minimal geometry (single point) and invisible material
 */
export function createAirTile(): THREE.Mesh {
  // Create a buffer geometry with a single point
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([0, 0, 0]); // Single point at origin
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  // Invisible material
  const material = new THREE.MeshBasicMaterial({
    visible: false,
    transparent: true,
    opacity: 0,
  });

  return new THREE.Mesh(geometry, material);
}

export function createPlaneTile(
  material: THREE.Material = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
  }),
  size: number = 1
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

/**
 * Creates a simple colored box tile
 *
 * @param color - Hex color value (e.g., 0xff0000 for red)
 * @param size - Size of the box (default: 1)
 * @returns A Mesh with box geometry and colored material
 */
export function createBoxTile(
  material: THREE.Material = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.2,
  }),
  size: number = 1
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  return new THREE.Mesh(geometry, material);
}

/**
 * Creates a simple colored sphere tile
 *
 * @param color - Hex color value (e.g., 0xff0000 for red)
 * @param radius - Radius of the sphere (default: 0.5)
 * @param segments - Number of segments for sphere detail (default: 16)
 * @returns A Mesh with sphere geometry and colored material
 */
export function createSphereTile(
  material: THREE.Material = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.5,
  }),
  radius: number = 0.5,
  segments: number = 16
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  return new THREE.Mesh(geometry, material);
}

/**
 * Creates a simple colored cylinder tile
 *
 * @param color - Hex color value (e.g., 0xff0000 for red)
 * @param radiusTop - Top radius (default: 0.3)
 * @param radiusBottom - Bottom radius (default: 0.3)
 * @param height - Height of the cylinder (default: 1)
 * @param segments - Number of radial segments (default: 16)
 * @returns A Mesh with cylinder geometry and colored material
 */
export function createCylinderTile(
  material: THREE.Material = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.1,
  }),
  radiusTop: number = 0.33,
  radiusBottom: number = 0.33,
  height: number = 1,
  segments: number = 16
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    segments
  );
  return new THREE.Mesh(geometry, material);
}
