import Demo from "./template";
import { ModelTile3DConfig } from "../src/wfc3d";
import { AdjacencyDemo } from "./adjacency-demo/demo";
export default function generate(modelDemo: Demo | AdjacencyDemo, tiles: ModelTile3DConfig[], isExpansion?: boolean): Promise<void>;
export declare function canExpand(): boolean;
export declare function resetExpansionState(): void;
/**
 * Shrink the grid by removing tiles
 */
export declare function shrinkGrid(modelDemo: Demo, newWidth: number, newHeight: number, newDepth: number): Promise<void>;
//# sourceMappingURL=generate.d.ts.map