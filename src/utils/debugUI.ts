/**
 * Shared UI components for WFC demos using lil-gui
 */
import GUI from "lil-gui";
import * as THREE from "three";
import type { BaseTile3DConfig } from "../wfc3d/WFCTile3D";
import {
  createTilesetEditor,
  type TilesetEditorElements,
  type TileTransform,
} from "./TilesetEditor";
import type { DebugGrid } from "./DebugGrid";
import type { InstancedModelRenderer } from "../renderers/InstancedModelRenderer";
import debugUIStyles from "./debugUI.css?inline";

/**
 * Interface defining what properties/methods a demo instance needs to work with the debug UI
 */
export interface DemoInstance {
  // Grid properties
  width: number;
  height: number;
  depth: number;
  cellSize?: number;
  previousWidth: number;
  previousHeight: number;
  previousDepth: number;

  // Generation properties
  currentSeed: number;
  tiles: BaseTile3DConfig[];
  isLoading?: boolean;

  // Mode properties
  expansionMode: boolean;
  useWorkers: boolean;
  workerCount: number;

  // Renderer references
  modelRenderer: InstancedModelRenderer | null;

  // Methods
  generate?: (isExpansion?: boolean) => Promise<void>;
  onCellSizeChange?: (cellSize: number) => void;
  resetExpansionState?: () => void;
  canExpand?: () => boolean;
  shrinkGrid?: (width: number, height: number, depth: number) => Promise<void>;
  getDebugGrid?: () => DebugGrid | null;
}

/**
 * Configuration for the debug UI
 */
export interface DebugUIConfig {
  demo: DemoInstance;
}

export interface DemoUIElements {
  gui: GUI;
  gridFolder: GUI;
  progressElement?: HTMLDivElement;
  tilesetEditor?: TilesetEditorElements;
}

export type { TileTransform };

// Legacy type alias for backward compatibility
export type DemoUIConfig = DebugUIConfig;

/**
 * Debug UI class for WFC demos
 */

export class DebugUI {
  public gui: GUI;
  public gridFolder: GUI;
  public progressElement: HTMLDivElement;
  public tilesetEditor?: TilesetEditorElements;

  private demo: DemoInstance;
  private static stylesInjected = false;

  constructor(demo: DemoInstance) {
    this.demo = demo;

    // Inject custom styles once
    if (!DebugUI.stylesInjected) {
      this.injectCustomStyles();
      DebugUI.stylesInjected = true;
    }

    this.gui = new GUI({
      width: 300,
    });

    this.gui.domElement.style.right = "0px";

    this.gridFolder = this.createGridControls();
    this.createWorkerControls();
    this.createDebugControls();
    this.createGenerationControls();
    this.progressElement = this.createProgressElement();
    this.gui.domElement.appendChild(this.progressElement);
    this.tilesetEditor = this.createTilesetEditor();
  }

  /**
   * Inject custom styles to override lil-gui defaults
   */
  private injectCustomStyles(): void {
    const styleId = "debug-ui-custom-styles";

    // Check if styles are already injected
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = debugUIStyles;

    document.head.appendChild(style);
  }

  /**
   * Helper to handle dimension changes with auto-expand logic
   */
  private handleDimensionChange(
    dimension: "width" | "height" | "depth",
    value: number
  ): void {
    this.demo[dimension] = value;

    // Handle auto-expand/shrink
    if (
      this.demo.expansionMode &&
      this.demo.canExpand &&
      this.demo.canExpand()
    ) {
      const widthIncreased = this.demo.width > this.demo.previousWidth;
      const heightIncreased = this.demo.height > this.demo.previousHeight;
      const depthIncreased = this.demo.depth > this.demo.previousDepth;

      const widthDecreased = this.demo.width < this.demo.previousWidth;
      const heightDecreased = this.demo.height < this.demo.previousHeight;
      const depthDecreased = this.demo.depth < this.demo.previousDepth;

      const anySizeIncreased =
        widthIncreased || heightIncreased || depthIncreased;
      const anySizeDecreased =
        widthDecreased || heightDecreased || depthDecreased;

      if (anySizeDecreased && !anySizeIncreased && this.demo.shrinkGrid) {
        setTimeout(() => {
          if (
            this.demo.expansionMode &&
            !this.demo.isLoading &&
            this.demo.shrinkGrid
          ) {
            this.demo.shrinkGrid(
              this.demo.width,
              this.demo.height,
              this.demo.depth
            );
          }
        }, 500);
      } else if (anySizeIncreased && !anySizeDecreased) {
        setTimeout(() => {
          if (
            this.demo.expansionMode &&
            !this.demo.isLoading &&
            this.demo.generate
          ) {
            this.demo.generate(true);
          }
        }, 500);
      } else if (anySizeIncreased && anySizeDecreased && this.demo.shrinkGrid) {
        setTimeout(async () => {
          if (
            this.demo.expansionMode &&
            !this.demo.isLoading &&
            this.demo.shrinkGrid
          ) {
            await this.demo.shrinkGrid(
              this.demo.width,
              this.demo.height,
              this.demo.depth
            );
            if (this.demo.generate) {
              await this.demo.generate(true);
            }
          }
        }, 500);
      }
    }

    // Update previous sizes
    this.demo.previousWidth = this.demo.width;
    this.demo.previousHeight = this.demo.height;
    this.demo.previousDepth = this.demo.depth;
  }

  /**
   * Create grid dimension controls
   */
  private createGridControls(): GUI {
    const gridFolder = this.gui.addFolder("Grid Dimensions");

    const params = {
      width: this.demo.width,
      height: this.demo.height,
      depth: this.demo.depth,
    };

    // Width control (default range: 5-30)
    gridFolder.add(params, "width", 5, 30, 1).onChange((value: number) => {
      this.handleDimensionChange("width", value);
    });

    // Height control (default range: 1-20)
    gridFolder.add(params, "height", 1, 20, 1).onChange((value: number) => {
      this.handleDimensionChange("height", value);
    });

    // Depth control (default range: 5-30)
    gridFolder.add(params, "depth", 5, 30, 1).onChange((value: number) => {
      this.handleDimensionChange("depth", value);
    });

    // Cell Size control (optional, default range: 0.1-10)
    if (this.demo.cellSize !== undefined) {
      const cellSizeParams = {
        cellSize: this.demo.cellSize,
      };

      gridFolder
        .add(cellSizeParams, "cellSize", 0.1, 10, 0.1)
        .name("cell size")
        .onChange((value: number) => {
          if (this.demo.cellSize !== undefined) {
            this.demo.cellSize = value;
          }
          if (this.demo.onCellSizeChange) {
            this.demo.onCellSizeChange(value);
          }
        });
    }

    // Auto-expand mode control
    const expansionParams = {
      autoExpand: this.demo.expansionMode,
    };

    gridFolder
      .add(expansionParams, "autoExpand")
      .name("Auto-expand Mode")
      .onChange((value: boolean) => {
        this.demo.expansionMode = value;
        if (!this.demo.expansionMode && this.demo.resetExpansionState) {
          this.demo.resetExpansionState();
        }
      });

    gridFolder.open();
    return gridFolder;
  }

  /**
   * Create generation controls
   */
  private createGenerationControls(): void {
    const params = {
      seed: this.demo.currentSeed,
      generate: () => {
        if (this.demo.generate) {
          this.demo.generate();
        }
      },
      randomSeed: () => {
        this.demo.currentSeed = Date.now();
        params.seed = this.demo.currentSeed;
        seedController.updateDisplay();
      },
    };

    const seedController = this.gui
      .add(params, "seed")
      .name("Seed")
      .onChange((value: number) => {
        this.demo.currentSeed = value;
      });

    this.gui.add(params, "randomSeed").name("Random Seed");
    this.gui.add(params, "generate").name("Generate");
  }

  /**
   * Create worker controls
   */
  private createWorkerControls(): void {
    const workerFolder = this.gui.addFolder("Workers");

    const workerParams = {
      useWorkers: this.demo.useWorkers,
      workerCount: this.demo.workerCount,
    };

    workerFolder
      .add(workerParams, "useWorkers")
      .name("Enable Multi-worker")
      .onChange((value: boolean) => {
        this.demo.useWorkers = value;
      });

    workerFolder
      .add(
        workerParams,
        "workerCount",
        1,
        navigator.hardwareConcurrency || 8,
        1
      )
      .name("Worker Count")
      .onChange((value: number) => {
        this.demo.workerCount = value;
      });
  }

  /**
   * Create debug controls
   */
  private createDebugControls(): void {
    const debugFolder = this.gui.addFolder("Debug");

    const debugParams = {
      wireframe: false,
    };

    debugFolder
      .add(debugParams, "wireframe")
      .name("Show Wireframe Grid")
      .onChange((value: boolean) => {
        const debugGrid = this.demo.getDebugGrid?.();
        if (debugGrid) {
          debugGrid.setVisible(value);
        }
      });
  }

  /**
   * Create tileset editor
   */
  private createTilesetEditor(): TilesetEditorElements | undefined {
    return createTilesetEditor({
      tiles: this.demo.tiles,
      parentGUI: this.gui,
      onTransformChange: (tileId: string, transform: TileTransform) => {
        if (this.demo.modelRenderer) {
          this.demo.modelRenderer.updateTileTransform(tileId, {
            position: new THREE.Vector3(
              transform.position.x,
              transform.position.y,
              transform.position.z
            ),
            rotation: new THREE.Euler(
              transform.rotation.x,
              transform.rotation.y,
              transform.rotation.z
            ),
            scale: new THREE.Vector3(
              transform.scale.x,
              transform.scale.y,
              transform.scale.z
            ),
          });
        }
      },
    });
  }

  /**
   * Create progress bar element
   */
  private createProgressElement(): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "progress-container";
    container.style.display = "none"; // Initially hidden

    const label = document.createElement("div");
    label.className = "progress-label";
    label.textContent = "Generating...";

    const barContainer = document.createElement("div");
    barContainer.className = "progress-bar";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = "0%"; // Initial progress

    barContainer.appendChild(fill);
    container.appendChild(label);
    container.appendChild(barContainer);

    return container;
  }
}

/**
 * Legacy function for backward compatibility
 */
export function createDebugUI(demo: DemoInstance): DemoUIElements {
  const debugUI = new DebugUI(demo);
  return {
    gui: debugUI.gui,
    gridFolder: debugUI.gridFolder,
    progressElement: debugUI.progressElement,
    tilesetEditor: debugUI.tilesetEditor,
  };
}

/**
 * Shows the progress bar with a message
 */
export function showProgress(
  elements: DemoUIElements,
  message: string = "Generating..."
): void {
  if (elements.progressElement) {
    elements.progressElement.style.display = "block";
    const label = elements.progressElement.querySelector(".progress-label");
    if (label) {
      label.textContent = message;
    }
  }
}

/**
 * Hides the progress bar
 */
export function hideProgress(elements: DemoUIElements): void {
  if (elements.progressElement) {
    elements.progressElement.style.display = "none";
  }
}

/**
 * Updates the progress bar percentage
 */
export function setProgress(elements: DemoUIElements, percent: number): void {
  if (elements.progressElement) {
    const fill = elements.progressElement.querySelector(
      ".progress-fill"
    ) as HTMLElement;
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
  }
}

/**
 * Sets the progress bar color
 */
export function setProgressColor(
  elements: DemoUIElements,
  color: string
): void {
  if (elements.progressElement) {
    const fill = elements.progressElement.querySelector(
      ".progress-fill"
    ) as HTMLElement;
    if (fill) {
      fill.style.backgroundColor = color;
    }
  }
}
