import { ModelTile3DConfig, WFCTile3D } from "../wfc3d/WFCTile3D";

export interface ValidationIssue {
  severity: "error" | "warning";
  type:
    | "missing_connectors"
    | "invalid_connector"
    | "isolated_tile"
    | "unreachable";
  message: string;
  tiles?: string[];
  direction?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
}

/**
 * Validate a tileset for common WFC issues using connector-based system
 */
export function validateTileset(
  configs: ModelTile3DConfig[]
): ValidationResult {
  console.log("Validating tileset...");
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  const tiles = configs.map((config) => new WFCTile3D(config));
  const tileMap = new Map(tiles.map((t) => [t.id, t]));

  // Check 1: Ensure all tiles have connectors
  for (const config of configs) {
    if (!config.connectors) {
      issues.push({
        severity: "error",
        type: "missing_connectors",
        message: `Tile '${config.id}' has no connectors defined`,
        tiles: [config.id],
      });
      continue;
    }

    // Check 2: Validate connector structure for each face
    const directions = [
      { name: "up", isVertical: true },
      { name: "down", isVertical: true },
      { name: "north", isVertical: false },
      { name: "south", isVertical: false },
      { name: "east", isVertical: false },
      { name: "west", isVertical: false },
    ] as const;

    for (const { name, isVertical } of directions) {
      const connector = config.connectors[name];

      if (!connector) {
        issues.push({
          severity: "error",
          type: "invalid_connector",
          message: `Tile '${config.id}' missing connector for ${name} face`,
          tiles: [config.id],
          direction: name,
        });
        continue;
      }

      if (!connector.groupId) {
        issues.push({
          severity: "error",
          type: "invalid_connector",
          message: `Tile '${config.id}' connector for ${name} face has no groupId`,
          tiles: [config.id],
          direction: name,
        });
      }

      if (isVertical) {
        // Vertical faces (up/down) should have rotation
        if (connector.rotation === undefined) {
          issues.push({
            severity: "error",
            type: "invalid_connector",
            message: `Tile '${config.id}' connector for ${name} face (vertical) has no rotation property`,
            tiles: [config.id],
            direction: name,
          });
        }
      } else {
        // Horizontal faces (north/south/east/west) should have symmetry
        if (connector.symmetry === undefined) {
          issues.push({
            severity: "error",
            type: "invalid_connector",
            message: `Tile '${config.id}' connector for ${name} face (horizontal) has no symmetry property`,
            tiles: [config.id],
            direction: name,
          });
        }
      }
    }

    // Check 3: Validate exclusions reference existing tiles
    if (config.exclusions) {
      for (const exclusion of config.exclusions) {
        if (!tileMap.has(exclusion.targetTileId)) {
          issues.push({
            severity: "warning",
            type: "invalid_connector",
            message: `Tile '${config.id}' has exclusion referencing non-existent tile '${exclusion.targetTileId}'`,
            tiles: [config.id, exclusion.targetTileId],
          });
        }
      }
    }
  }

  // Check 4: Find isolated tiles (tiles with no compatible neighbors)
  for (const tile of tiles) {
    let hasCompatibleNeighbor = false;

    for (let dir = 0; dir < 6; dir++) {
      for (const otherTile of tiles) {
        if (tile.id === otherTile.id) continue;

        if (tile.canBeAdjacentTo(otherTile, dir)) {
          hasCompatibleNeighbor = true;
          break;
        }
      }

      if (hasCompatibleNeighbor) break;
    }

    if (!hasCompatibleNeighbor) {
      issues.push({
        severity: "warning",
        type: "isolated_tile",
        message: `Tile '${tile.id}' has no compatible neighbors in any direction`,
        tiles: [tile.id],
      });
    }
  }

  // Check 5: Ensure all tiles are reachable from each other
  const reachability = checkReachability(tiles);
  if (reachability.unreachableTiles.length > 0) {
    issues.push({
      severity: "warning",
      type: "unreachable",
      message: `Some tiles may be unreachable: ${reachability.unreachableTiles.join(
        ", "
      )}`,
      tiles: reachability.unreachableTiles,
    });
  }

  // Generate suggestions
  if (issues.some((i) => i.type === "invalid_connector")) {
    suggestions.push(
      "Ensure all connectors have groupId, and correct symmetry/rotation properties"
    );
  }

  if (issues.some((i) => i.type === "isolated_tile")) {
    suggestions.push(
      "Isolated tiles will never be placed. Check connector groupIds and symmetry/rotation values."
    );
  }

  if (issues.length === 0) {
    suggestions.push(
      "✅ Tileset validation passed! All connectors are properly defined."
    );
  }

  // Add note about connector system
  suggestions.push(
    "Note: Connectors use groupId matching. Vertical faces use rotation (0-3 or invariant), horizontal faces use symmetry (flipped/not-flipped/symmetric)."
  );

  const hasErrors = issues.some((i) => i.severity === "error");

  if (hasErrors) {
    console.warn("⚠️ Tileset validation found issues:");
    for (const issue of issues) {
      const prefix = issue.severity === "error" ? "❌" : "⚠️";
      console.warn(`${prefix} ${issue.message}`);
    }
  }
  if (suggestions.length > 0) {
    console.log("💡 Suggestions:");
    for (const suggestion of suggestions) {
      console.log(`  - ${suggestion}`);
    }
  }
  if (!hasErrors) console.log("✅ Tileset validation passed!");

  return {
    valid: !hasErrors,
    issues,
    suggestions,
  };
}

/**
 * Check if all tiles can reach each other through connector compatibility
 */
function checkReachability(tiles: WFCTile3D[]): {
  unreachableTiles: string[];
} {
  if (tiles.length === 0) return { unreachableTiles: [] };

  // Build adjacency graph based on connector compatibility
  const graph = new Map<string, Set<string>>();

  for (const tile of tiles) {
    const neighbors = new Set<string>();

    for (let dir = 0; dir < 6; dir++) {
      for (const otherTile of tiles) {
        if (tile.id === otherTile.id) continue;

        if (tile.canBeAdjacentTo(otherTile, dir)) {
          neighbors.add(otherTile.id);
        }
      }
    }

    graph.set(tile.id, neighbors);
  }

  // BFS from first tile
  const visited = new Set<string>();
  const queue = [tiles[0].id];
  visited.add(tiles[0].id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.get(current) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // Find unreachable tiles
  const unreachableTiles = tiles
    .map((t) => t.id)
    .filter((id) => !visited.has(id));

  return { unreachableTiles };
}

/**
 * Get compatibility matrix for visualization
 */
export function getCompatibilityMatrix(
  configs: ModelTile3DConfig[]
): Map<string, Map<string, Set<number>>> {
  const tiles = configs.map((config) => new WFCTile3D(config));
  const matrix = new Map<string, Map<string, Set<number>>>();

  for (const tile of tiles) {
    const tileCompat = new Map<string, Set<number>>();

    for (let direction = 0; direction < 6; direction++) {
      for (const otherTile of tiles) {
        if (tile.id === otherTile.id) continue;

        if (tile.canBeAdjacentTo(otherTile, direction)) {
          if (!tileCompat.has(otherTile.id)) {
            tileCompat.set(otherTile.id, new Set());
          }
          tileCompat.get(otherTile.id)!.add(direction);
        }
      }
    }

    matrix.set(tile.id, tileCompat);
  }

  return matrix;
}

/**
 * Suggest fixes for common issues
 */
export function suggestFixes(result: ValidationResult): string[] {
  const fixes: string[] = [];

  for (const issue of result.issues) {
    if (issue.type === "invalid_connector" && issue.tiles && issue.direction) {
      fixes.push(
        `Fix connector for tile '${issue.tiles[0]}' in ${issue.direction} direction`
      );
    }

    if (issue.type === "isolated_tile" && issue.tiles) {
      fixes.push(
        `Check connector groupIds and properties for '${issue.tiles[0]}' to ensure it can connect to other tiles`
      );
    }
  }

  return fixes;
}
