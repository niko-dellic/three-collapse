import { WFCTile3D, type BaseTile3DConfig } from "../wfc3d/WFCTile3D";

export interface ValidationIssue {
  severity: "error" | "warning";
  type: "missing_adjacency" | "asymmetric" | "isolated_tile" | "unreachable";
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
 * Validate a tileset for common WFC issues
 */
export function validateTileset(configs: BaseTile3DConfig[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  const tiles = configs.map((config) => new WFCTile3D(config));
  const tileMap = new Map(tiles.map((t) => [t.id, t]));

  // Check 1: Ensure all tiles have adjacency rules
  for (const tile of tiles) {
    if (tile.adjacency.size === 0) {
      issues.push({
        severity: "warning",
        type: "missing_adjacency",
        message: `Tile '${tile.id}' has no adjacency rules (will accept all neighbors)`,
        tiles: [tile.id],
      });
    }
  }

  // Check 2: Verify adjacency symmetry (STRICT - this is critical for WFC)
  const directions = [
    { dir: 0, name: "up", opposite: 1, oppositeName: "down" },
    { dir: 1, name: "down", opposite: 0, oppositeName: "up" },
    { dir: 2, name: "north", opposite: 3, oppositeName: "south" },
    { dir: 3, name: "south", opposite: 2, oppositeName: "north" },
    { dir: 4, name: "east", opposite: 5, oppositeName: "west" },
    { dir: 5, name: "west", opposite: 4, oppositeName: "east" },
  ];

  for (const tile of tiles) {
    for (const { dir, name, opposite, oppositeName } of directions) {
      const neighbors = tile.adjacency.get(dir);
      if (!neighbors) continue; // No constraints in this direction

      for (const neighborId of neighbors) {
        const neighbor = tileMap.get(neighborId);
        if (!neighbor) {
          issues.push({
            severity: "error",
            type: "missing_adjacency",
            message: `Tile '${tile.id}' references non-existent tile '${neighborId}' in ${name} direction`,
            tiles: [tile.id, neighborId],
            direction: name,
          });
          continue;
        }

        // Check if the adjacency is symmetric
        const reverseNeighbors = neighbor.adjacency.get(opposite);

        // If reverse direction has constraints but doesn't include this tile, it's an ERROR
        if (reverseNeighbors && !reverseNeighbors.has(tile.id)) {
          issues.push({
            severity: "error", // Changed from "warning" to "error"
            type: "asymmetric",
            message: `ASYMMETRY: '${tile.id}' allows '${neighborId}' in ${name} direction, but '${neighborId}' does NOT allow '${tile.id}' in ${oppositeName} direction. This will cause contradictions!`,
            tiles: [tile.id, neighborId],
            direction: name,
          });

          suggestions.push(
            `Fix: Add '${tile.id}' to tile '${neighborId}' adjacency.${oppositeName} array`
          );
        }

        // If reverse direction has NO constraints (undefined), it's okay (means all tiles allowed)
        // This is fine and won't cause issues
      }
    }
  }

  // Check 3: Find isolated tiles (tiles with empty adjacency arrays)
  // Empty array [] = no tiles allowed in that direction (strict restriction)
  // Omitting the direction = all tiles allowed (no restriction)
  for (const tile of tiles) {
    for (const { dir, name } of directions) {
      const neighbors = tile.adjacency.get(dir);
      // If direction is explicitly set with empty array, flag as error
      if (neighbors && neighbors.size === 0) {
        issues.push({
          severity: "error",
          type: "isolated_tile",
          message: `Tile '${tile.id}' has empty adjacency list [] in ${name} direction - no tiles can be placed there. This will cause contradictions unless intentional.`,
          tiles: [tile.id],
          direction: name,
        });

        suggestions.push(
          `If '${tile.id}' should allow tiles in ${name} direction, add tile IDs to the array. If it should allow ALL tiles, omit the '${name}' property entirely.`
        );
      }
    }
  }

  // Check 4: Ensure all tiles are reachable from each other
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
  if (issues.some((i) => i.type === "asymmetric")) {
    if (suggestions.length === 0) {
      suggestions.push(
        "CRITICAL: Asymmetric adjacency rules WILL cause WFC failures. Fix all asymmetry errors before generating."
      );
    }
  }

  if (issues.some((i) => i.type === "isolated_tile")) {
    suggestions.push(
      "Isolated tiles with empty adjacency will cause contradictions"
    );
  }

  if (issues.length === 0) {
    suggestions.push(
      "✅ Tileset validation passed! All adjacency rules are symmetric."
    );
  }

  // Add note about adjacency specification
  suggestions.push(
    "Note: Omit a direction entirely for 'no restrictions'. Use empty array [] for 'no tiles allowed'."
  );

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    suggestions,
  };
}

/**
 * Check if all tiles can reach each other through adjacency
 */
function checkReachability(tiles: WFCTile3D[]): {
  unreachableTiles: string[];
} {
  if (tiles.length === 0) return { unreachableTiles: [] };

  // Build adjacency graph
  const graph = new Map<string, Set<string>>();
  for (const tile of tiles) {
    const neighbors = new Set<string>();
    for (const adjacentSet of tile.adjacency.values()) {
      for (const id of adjacentSet) {
        neighbors.add(id);
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
  configs: BaseTile3DConfig[]
): Map<string, Map<string, Set<number>>> {
  const tiles = configs.map((config) => new WFCTile3D(config));
  const matrix = new Map<string, Map<string, Set<number>>>();

  for (const tile of tiles) {
    const tileCompat = new Map<string, Set<number>>();

    for (const [direction, neighbors] of tile.adjacency.entries()) {
      for (const neighborId of neighbors) {
        if (!tileCompat.has(neighborId)) {
          tileCompat.set(neighborId, new Set());
        }
        tileCompat.get(neighborId)!.add(direction);
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
    if (issue.type === "asymmetric" && issue.tiles && issue.direction) {
      const [tile1, tile2] = issue.tiles;
      fixes.push(
        `Add '${tile1}' to '${tile2}'s adjacency in the opposite of ${issue.direction}`
      );
    }

    if (issue.type === "isolated_tile" && issue.tiles && issue.direction) {
      fixes.push(
        `Add at least one valid neighbor for '${issue.tiles[0]}' in ${issue.direction} direction`
      );
    }
  }

  return fixes;
}
