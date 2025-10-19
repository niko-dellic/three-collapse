/**
 * Example demonstrating sparse grid local expansion
 */
import * as THREE from "three";
import { WFCGenerator } from "../src/generators/WFCGenerator";
import { ModelTile3DConfig } from "../src/wfc3d";

// Example tile configuration (simplified)
const tiles: ModelTile3DConfig[] = [
  {
    id: "empty",
    model: "models/empty.glb",
    weight: 5.0,
    adjacency: {
      up: ["empty", "block"],
      down: ["empty", "block"],
      north: ["empty", "block"],
      south: ["empty", "block"],
      east: ["empty", "block"],
      west: ["empty", "block"],
    },
  },
  {
    id: "block",
    model: "models/block.glb",
    weight: 1.0,
    adjacency: {
      up: ["empty"],
      down: ["empty"],
      north: ["empty", "block"],
      south: ["empty", "block"],
      east: ["empty", "block"],
      west: ["empty", "block"],
    },
  },
];

async function demonstrateSparseExpansion() {
  // Setup scene
  const scene = new THREE.Scene();

  // Create generator
  const generator = new WFCGenerator(tiles, {
    scene,
    width: 10,
    height: 5,
    depth: 10,
    cellSize: 1,
    debug: true,
  });

  try {
    // 1. Generate initial grid
    console.log("Generating initial grid...");
    const initialGrid = await generator.generate();
    console.log(`Generated ${initialGrid.size} cells`);

    // 2. Find a peripheral cell (e.g., at the edge)
    const testCellX = 0;
    const testCellY = 0;
    const testCellZ = 5;

    // 3. Validate it's on periphery
    const isPeriphery = generator.isCellOnPeriphery(
      testCellX,
      testCellY,
      testCellZ
    );
    console.log(
      `Cell (${testCellX}, ${testCellY}, ${testCellZ}) is on periphery: ${isPeriphery}`
    );

    if (isPeriphery) {
      // 4. Expand from that cell
      console.log("Expanding from cell...");
      const expandedGrid = await generator.expandFromCell(
        testCellX,
        testCellY,
        testCellZ,
        5, // expansionX
        3, // expansionY
        5 // expansionZ
      );
      console.log(`Expanded grid now has ${expandedGrid.size} cells`);

      // 5. Access specific cells in sparse map
      const key = `${testCellX},${testCellY},${testCellZ}`;
      const tileId = expandedGrid.get(key);
      console.log(
        `Tile at (${testCellX}, ${testCellY}, ${testCellZ}): ${tileId}`
      );

      // 6. Iterate over all cells
      console.log("\nAll cells in sparse grid:");
      let count = 0;
      for (const [key, tileId] of expandedGrid.entries()) {
        if (count < 5) {
          // Show first 5 for brevity
          const [x, y, z] = key.split(",").map(Number);
          console.log(`  (${x}, ${y}, ${z}): ${tileId}`);
        }
        count++;
      }
      console.log(`  ... and ${count - 5} more cells`);

      // 7. Optional: Convert to array format for compatibility
      const arrayGrid = generator.mapToArray(expandedGrid);
      console.log(
        `\nConverted to array: ${arrayGrid.length}x${arrayGrid[0]?.length}x${arrayGrid[0]?.[0]?.length}`
      );

      // 8. Delete cells from a region
      console.log("\nDeleting cells...");
      const reducedGrid = await generator.deleteFromCell(
        testCellX + 2,
        testCellY,
        testCellZ,
        3, // deletionX
        2, // deletionY
        3 // deletionZ
      );
      console.log(`After deletion: ${reducedGrid.size} cells`);
    } else {
      console.log("Cell is not on periphery, trying another cell...");

      // Try edge cells
      const edgeCells = [
        [0, 0, 0],
        [9, 0, 0],
        [0, 0, 9],
        [9, 0, 9],
      ];

      for (const [x, y, z] of edgeCells) {
        if (generator.isCellOnPeriphery(x, y, z)) {
          console.log(`Found peripheral cell at (${x}, ${y}, ${z})`);
          break;
        }
      }
    }

    // 9. Get the final grid state
    const finalGrid = generator.getLastGrid();
    console.log(`\nFinal grid state: ${finalGrid?.size || 0} cells`);
  } catch (error) {
    console.error("Error during sparse expansion demo:", error);
  }
}

// Export for use in examples
export { demonstrateSparseExpansion };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSparseExpansion();
}
