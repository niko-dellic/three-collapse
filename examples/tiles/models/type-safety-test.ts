/**
 * TypeScript Type Safety Test for Exclusive Adjacency
 *
 * This file demonstrates that TypeScript now enforces mutual exclusivity
 * between inclusive and exclusive rules for each direction.
 */

import { ModelTile3DConfig } from "../../../src/wfc3d";

// ✅ VALID: Using only inclusive rule
const validInclusive: ModelTile3DConfig = {
  id: "test1",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"], // Only inclusive
  },
};

// ✅ VALID: Using only exclusive rule
const validExclusive: ModelTile3DConfig = {
  id: "test2",
  model: "/models/test.glb",
  adjacency: {
    upEx: ["solid"], // Only exclusive
  },
};

// ✅ VALID: Using both on different directions
const validMixed: ModelTile3DConfig = {
  id: "test3",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"], // Inclusive for up
    downEx: ["air"], // Exclusive for down
    north: ["wall"], // Inclusive for north
    southEx: ["lava"], // Exclusive for south
  },
};

// ✅ VALID: Omitting a direction entirely
const validOmitted: ModelTile3DConfig = {
  id: "test4",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"], // Only specify up
    // down is omitted = no restrictions
  },
};

// ❌ INVALID: TypeScript error - can't use both up and upEx
// Uncomment to see the error:
/*
const invalidBothUpRules: ModelTile3DConfig = {
  id: "test5",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"],      // ❌ Error: Can't have both
    upEx: ["solid"],  // ❌ Error: Can't have both
  },
};
*/

// ❌ INVALID: TypeScript error - can't use both down and downEx
// Uncomment to see the error:
/*
const invalidBothDownRules: ModelTile3DConfig = {
  id: "test6",
  model: "/models/test.glb",
  adjacency: {
    down: ["ground"],    // ❌ Error: Can't have both
    downEx: ["air"],     // ❌ Error: Can't have both
  },
};
*/

// ❌ INVALID: Multiple violations
// Uncomment to see the errors:
/*
const invalidMultiple: ModelTile3DConfig = {
  id: "test7",
  model: "/models/test.glb",
  adjacency: {
    up: ["air"],
    upEx: ["solid"],      // ❌ Error
    north: ["wall"],
    northEx: ["lava"],    // ❌ Error
    east: ["ground"],
    eastEx: ["air"],      // ❌ Error
  },
};
*/

/**
 * Summary of Type Safety:
 *
 * ✅ You CAN:
 * - Use only `up` (inclusive)
 * - Use only `upEx` (exclusive)
 * - Mix inclusive and exclusive on DIFFERENT directions
 * - Omit directions entirely (no restrictions)
 *
 * ❌ You CANNOT:
 * - Use both `up` and `upEx` on the SAME tile
 * - Use both `down` and `downEx` on the SAME tile
 * - Use both `north` and `northEx` on the SAME tile
 * - And so on for all 6 directions
 *
 * TypeScript will show compile-time errors if you try to violate these rules!
 */

console.log("✅ Type safety test file compiled successfully!");
console.log("All valid examples passed TypeScript type checking.");
console.log("Uncomment the invalid examples to see TypeScript errors.");

export { validInclusive, validExclusive, validMixed, validOmitted };
