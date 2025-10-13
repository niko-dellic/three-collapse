/**
 * 3D region bounds
 */
export interface Region3D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

/**
 * Split a 3D grid into approximately equal regions for parallel processing
 */
export function splitGridIntoRegions(
  width: number,
  height: number,
  depth: number,
  workerCount: number
): Region3D[] {
  if (workerCount <= 1) {
    return [
      { xMin: 0, xMax: width, yMin: 0, yMax: height, zMin: 0, zMax: depth },
    ];
  }

  // Determine best split strategy
  const dimensions = [
    { axis: "x", size: width },
    { axis: "y", size: height },
    { axis: "z", size: depth },
  ].sort((a, b) => b.size - a.size);

  // Calculate splits per axis
  const splits = calculateSplits(workerCount);

  // Assign splits to axes (prefer splitting largest dimensions)
  const splitX =
    dimensions[0].axis === "x"
      ? splits[0]
      : dimensions[1].axis === "x"
      ? splits[1]
      : splits[2];
  const splitY =
    dimensions[0].axis === "y"
      ? splits[0]
      : dimensions[1].axis === "y"
      ? splits[1]
      : splits[2];
  const splitZ =
    dimensions[0].axis === "z"
      ? splits[0]
      : dimensions[1].axis === "z"
      ? splits[1]
      : splits[2];

  // Create regions
  const regions: Region3D[] = [];

  for (let ix = 0; ix < splitX; ix++) {
    for (let iy = 0; iy < splitY; iy++) {
      for (let iz = 0; iz < splitZ; iz++) {
        const xMin = Math.floor((ix * width) / splitX);
        const xMax = Math.floor(((ix + 1) * width) / splitX);
        const yMin = Math.floor((iy * height) / splitY);
        const yMax = Math.floor(((iy + 1) * height) / splitY);
        const zMin = Math.floor((iz * depth) / splitZ);
        const zMax = Math.floor(((iz + 1) * depth) / splitZ);

        regions.push({ xMin, xMax, yMin, yMax, zMin, zMax });
      }
    }
  }

  return regions;
}

/**
 * Calculate how to split across 3 axes to get close to target count
 * Returns [splitX, splitY, splitZ] where the product is close to targetCount
 */
function calculateSplits(targetCount: number): [number, number, number] {
  // Try to create cubic-ish regions
  const cubeRoot = Math.cbrt(targetCount);

  // Start with closest integers
  let bestSplits: [number, number, number] = [1, 1, 1];
  let bestDiff = Infinity;

  // Try various combinations around the cube root
  for (let x = 1; x <= targetCount; x++) {
    for (let y = 1; y <= Math.ceil(targetCount / x); y++) {
      const z = Math.max(1, Math.ceil(targetCount / (x * y)));
      const total = x * y * z;

      if (total >= targetCount) {
        const diff = total - targetCount;
        const variance =
          Math.abs(x - cubeRoot) +
          Math.abs(y - cubeRoot) +
          Math.abs(z - cubeRoot);

        // Prefer splits that are closer to target count and more cubic
        const score = diff * 10 + variance;

        if (score < bestDiff) {
          bestDiff = score;
          bestSplits = [x, y, z];
        }
      }
    }
  }

  return bestSplits;
}

/**
 * Get boundary cells between regions
 * Returns array of [x, y, z] coordinates that are on region boundaries
 */
export function getBoundaryCells(
  width: number,
  height: number,
  depth: number,
  regions: Region3D[]
): Array<[number, number, number]> {
  const boundaries = new Set<string>();

  // For each region, find cells on its boundaries with other regions
  for (const region of regions) {
    // Check each face of the region
    // +X face
    if (region.xMax < width) {
      for (let y = region.yMin; y < region.yMax; y++) {
        for (let z = region.zMin; z < region.zMax; z++) {
          boundaries.add(`${region.xMax - 1},${y},${z}`);
        }
      }
    }

    // +Y face
    if (region.yMax < height) {
      for (let x = region.xMin; x < region.xMax; x++) {
        for (let z = region.zMin; z < region.zMax; z++) {
          boundaries.add(`${x},${region.yMax - 1},${z}`);
        }
      }
    }

    // +Z face
    if (region.zMax < depth) {
      for (let x = region.xMin; x < region.xMax; x++) {
        for (let y = region.yMin; y < region.yMax; y++) {
          boundaries.add(`${x},${y},${region.zMax - 1}`);
        }
      }
    }
  }

  return Array.from(boundaries).map((key) => {
    const [x, y, z] = key.split(",").map(Number);
    return [x, y, z] as [number, number, number];
  });
}
