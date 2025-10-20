import type {
  ModelTile3DConfig,
  TileConnectors,
  DirectionalExclusion,
} from "../wfc3d";

/**
 * Convert legacy adjacency-based tile configs to connector-based configs
 *
 * This helper function provides backward compatibility for old adjacency-based tilesets.
 * It generates connectors by analyzing adjacency patterns across all tiles.
 *
 * Strategy:
 * 1. For each direction, group tiles by their adjacency patterns
 * 2. Assign the same groupId to tiles with matching adjacency patterns
 * 3. Set permissive defaults (symmetric/invariant) to allow maximum compatibility
 * 4. Generate exclusions for explicitly excluded tiles
 *
 * @param configs - Array of legacy tile configurations with adjacency rules
 * @returns Array of connector-based tile configurations
 *
 * @example
 * ```typescript
 * const legacyTileset = [
 *   { id: "floor", adjacency: { up: ["wall"], down: [] }, ... },
 *   { id: "wall", adjacency: { up: ["air"], down: ["floor"] }, ... }
 * ];
 *
 * const connectorTileset = convertAdjacencyToConnectors(legacyTileset);
 * // Now compatible with the new WFC system
 * ```
 */
export function convertAdjacencyToConnectors(
  configs: ModelTile3DConfig[]
): ModelTile3DConfig[] {
  // Build a map of adjacency patterns to groupIds
  const directions = ["up", "down", "north", "south", "east", "west"] as const;
  const patternToGroupId = new Map<string, string>();
  let nextGroupId = 0;

  const getGroupId = (pattern: string): string => {
    if (!patternToGroupId.has(pattern)) {
      patternToGroupId.set(pattern, `group_${nextGroupId++}`);
    }
    return patternToGroupId.get(pattern)!;
  };

  return configs.map((config) => {
    if (!config.adjacency) {
      throw new Error(
        `Tile '${config.id}' has no adjacency rules. Cannot convert to connectors. ` +
          `Use ConnectorBuilderUI to create proper connector-based tilesets.`
      );
    }

    const connectors: TileConnectors = {
      up: { groupId: "", rotation: "invariant" },
      down: { groupId: "", rotation: "invariant" },
      north: { groupId: "", symmetry: "symmetric" },
      south: { groupId: "", symmetry: "symmetric" },
      east: { groupId: "", symmetry: "symmetric" },
      west: { groupId: "", symmetry: "symmetric" },
    };

    const exclusions: DirectionalExclusion[] = [];

    for (const dir of directions) {
      const isVertical = dir === "up" || dir === "down";

      // Get adjacency rules for this direction
      const adjacentTiles = (config.adjacency as any)[dir] as
        | string[]
        | undefined;
      const excludedTiles = (config.adjacency as any)[`${dir}Ex`] as
        | string[]
        | undefined;

      // Create a pattern string to group similar adjacency rules
      let pattern: string;
      if (adjacentTiles && adjacentTiles.length > 0) {
        // Inclusive rule: specific tiles allowed
        pattern = `${dir}:include:${adjacentTiles.sort().join(",")}`;
      } else if (excludedTiles && excludedTiles.length > 0) {
        // Exclusive rule: specific tiles excluded
        pattern = `${dir}:exclude:${excludedTiles.sort().join(",")}`;

        // Generate exclusions for each excluded tile
        for (const excludedTileId of excludedTiles) {
          exclusions.push({
            targetTileId: excludedTileId,
            direction: dir,
          });
        }
      } else {
        // No constraints: allow all
        pattern = `${dir}:all`;
      }

      // Assign groupId based on pattern
      const groupId = getGroupId(pattern);

      if (isVertical) {
        connectors[dir].groupId = groupId;
        connectors[dir].rotation = "invariant"; // Most permissive
      } else {
        connectors[dir].groupId = groupId;
        connectors[dir].symmetry = "symmetric"; // Most permissive
      }
    }

    // Handle base rules (all/allEx)
    const allTiles = (config.adjacency as any).all as string[] | undefined;
    const allExTiles = (config.adjacency as any).allEx as string[] | undefined;

    if (allTiles || allExTiles) {
      // If base rules exist, apply them to all directions without specific rules
      for (const dir of directions) {
        const hasSpecificRule =
          (config.adjacency as any)[dir] !== undefined ||
          (config.adjacency as any)[`${dir}Ex`] !== undefined;

        if (!hasSpecificRule) {
          const isVertical = dir === "up" || dir === "down";
          let pattern: string;

          if (allTiles && allTiles.length > 0) {
            pattern = `${dir}:include:${allTiles.sort().join(",")}`;
          } else if (allExTiles && allExTiles.length > 0) {
            pattern = `${dir}:exclude:${allExTiles.sort().join(",")}`;

            // Generate exclusions
            for (const excludedTileId of allExTiles) {
              exclusions.push({
                targetTileId: excludedTileId,
                direction: dir,
              });
            }
          } else {
            pattern = `${dir}:all`;
          }

          const groupId = getGroupId(pattern);

          if (isVertical) {
            connectors[dir].groupId = groupId;
          } else {
            connectors[dir].groupId = groupId;
          }
        }
      }
    }

    return {
      ...config,
      connectors,
      exclusions: exclusions.length > 0 ? exclusions : undefined,
      // Keep adjacency for reference but mark it as legacy
      adjacency: config.adjacency,
    };
  });
}

/**
 * Quick check if a tileset needs conversion
 */
export function needsConnectorConversion(
  configs: ModelTile3DConfig[]
): boolean {
  return configs.some((config) => !config.connectors && config.adjacency);
}
