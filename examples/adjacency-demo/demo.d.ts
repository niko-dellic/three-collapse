/**
 * Adjacency Demo - GLB UserData Workflow
 *
 * This example demonstrates the complete workflow:
 * 1. Load GLB files from a folder using import.meta.glob
 * 2. Read adjacency data from GLB userData
 * 3. Use in WFC generation
 */
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import { DebugGrid } from "../../src/utils/DebugGrid";
import type { ModelTile3DConfig } from "../../src/wfc3d";
import { type DemoUIElements } from "../../src/utils/debugUI";
/**
 * Demo class for GLB-based WFC with embedded adjacency data
 */
export declare class AdjacencyDemo {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    glbLoader: GLBTileLoader;
    modelRenderer: InstancedModelRenderer | null;
    debugGrid: DebugGrid;
    width: number;
    height: number;
    depth: number;
    cellSize: number;
    currentSeed: number;
    isLoading: boolean;
    animate: () => void;
    ui: DemoUIElements;
    previousWidth: number;
    previousHeight: number;
    previousDepth: number;
    expansionMode: boolean;
    useWorkers: boolean;
    workerCount: number;
    tiles: ModelTile3DConfig[];
    constructor(tiles: ModelTile3DConfig[]);
    onGridSizeChange(): void;
    generate(isExpansion?: boolean): Promise<void>;
    private shrink;
    private shrinkThenExpand;
}
//# sourceMappingURL=demo.d.ts.map