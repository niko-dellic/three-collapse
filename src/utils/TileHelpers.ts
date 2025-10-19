import * as THREE from "three";
import type { ModelTile3DConfig } from "../wfc3d";

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
export function validateTileAdjacency<T extends ModelTile3DConfig>(
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
export function prepareTilesForWorker<T extends ModelTile3DConfig>(
  tiles: T[]
): Omit<ModelTile3DConfig, "model">[] {
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
  radiusTop: number = 0.125,
  radiusBottom: number = 0.125,
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

/**
 * Options for converting GLTF objects to tile configs
 */
export interface GLTFToTilesOptions {
  /** Whether to recursively traverse the object hierarchy (default: true) */
  recursive?: boolean;
  /** Prefix to add to tile IDs (e.g., filename without extension) */
  idPrefix?: string;
  /** Base rotation to apply to all tiles */
  baseRotation?: THREE.Euler;
  /** Base position offset to apply to all tiles */
  basePosition?: THREE.Vector3;
  /** Base scale to apply to all tiles */
  baseScale?: THREE.Vector3;
  /** Whether to set materials to double-sided (default: true) */
  doubleSided?: boolean;
  /** Default weight for tiles without userData.weight (default: 1) */
  defaultWeight?: number;
}

/**
 * Converts a GLTF scene/object to an array of ModelTile3DConfig
 *
 * This utility extracts meshes from a loaded GLTF object and converts them to
 * tile configurations, reading adjacency data and other properties from userData.
 *
 * @param object - The THREE.Object3D (typically from GLTF.scene) to convert
 * @param options - Configuration options for the conversion
 * @returns Array of ModelTile3DConfig objects
 *
 * @example
 * ```typescript
 * const gltf = await gltfLoader.loadAsync('model.glb');
 * const tiles = gltfObjectToTiles(gltf.scene, {
 *   idPrefix: 'building',
 *   baseRotation: new THREE.Euler(Math.PI / 2, 0, 0),
 *   recursive: true
 * });
 * ```
 *
 * Expected userData structure on meshes:
 * - `tileId` (string): Custom tile ID (optional, falls back to mesh name)
 * - `adjacency` (object): Adjacency rules (e.g., { north: ['tile1', 'tile2'], south: [...] })
 * - `weight` (number): Tile weight for WFC probability (default: 1)
 */
export function gltfObjectToTiles(
  object: THREE.Object3D,
  options: GLTFToTilesOptions = {}
): ModelTile3DConfig[] {
  const {
    recursive = true,
    idPrefix = "",
    baseRotation,
    basePosition,
    baseScale,
    doubleSided = true,
    defaultWeight = 1,
  } = options;

  const meshes: THREE.Mesh[] = [];

  if (recursive) {
    // Recursively traverse the object hierarchy
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
  } else {
    // Only check direct children
    object.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });

    // If the object itself is a mesh, include it
    if (object instanceof THREE.Mesh) {
      meshes.push(object);
    }
  }

  const tiles: ModelTile3DConfig[] = [];

  meshes.forEach((mesh) => {
    // Set material to double-sided if requested
    if (doubleSided && mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          mat.side = THREE.DoubleSide;
        });
      } else {
        mesh.material.side = THREE.DoubleSide;
      }
    }

    // Generate tile ID: check userData.tileId first, then use prefix_meshname, or just meshname
    const userTileId = mesh.userData.tileId as string | undefined;
    const meshName = mesh.name || "mesh";
    const tileId =
      userTileId || (idPrefix ? `${idPrefix}_${meshName}` : meshName);

    // Extract adjacency and weight from mesh userData
    const adjacency = mesh.userData.adjacency || {};
    const weight =
      (mesh.userData.weight as number | undefined) ?? defaultWeight;

    // Build the config
    const config: ModelTile3DConfig = {
      id: tileId,
      model: mesh,
      weight,
      adjacency,
    };

    // Add optional transform properties if provided
    if (baseRotation) {
      config.rotation = baseRotation.clone();
    }
    if (basePosition) {
      config.position = basePosition.clone();
    }
    if (baseScale) {
      config.scale = baseScale.clone();
    }

    tiles.push(config);
  });

  return tiles;
}
