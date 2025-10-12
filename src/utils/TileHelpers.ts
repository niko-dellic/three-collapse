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

/**
 * Creates a simple colored box tile
 *
 * @param color - Hex color value (e.g., 0xff0000 for red)
 * @param size - Size of the box (default: 1)
 * @returns A Mesh with box geometry and colored material
 */
export function createBoxTile(color: number, size: number = 1): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.2,
  });
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
  color: number,
  radius: number = 0.5,
  segments: number = 16
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.5,
  });
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
  color: number,
  radiusTop: number = 0.3,
  radiusBottom: number = 0.3,
  height: number = 1,
  segments: number = 16
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    segments
  );
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
  });
  return new THREE.Mesh(geometry, material);
}
