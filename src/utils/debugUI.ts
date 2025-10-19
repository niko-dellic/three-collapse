/**
 * Shared UI components for WFC demos using lil-gui
 */
import GUI from "lil-gui";
import * as THREE from "three";
import type { WFCGenerator } from "../generators/WFCGenerator";
import {
  createTilesetEditor,
  type TilesetEditorElements,
  type TileTransform,
} from "./TilesetEditor";
import debugUIStyles from "./debugUI.css?inline";

export interface DebugUIElements {
  gui: GUI;
  gridFolder: GUI;
  progressElement?: HTMLDivElement;
  tilesetEditor?: TilesetEditorElements;
}

export type { TileTransform };

/**
 * Debug UI class for WFC demos
 */

export class DebugUI {
  public gui: GUI;
  public gridFolder: GUI;
  public progressElement: HTMLDivElement;
  public tilesetEditor?: TilesetEditorElements;
  public generator: WFCGenerator;

  // Track UI state
  private currentWidth: number = 10;
  private currentHeight: number = 8;
  private currentDepth: number = 10;

  private static stylesInjected = false;

  constructor(generator: WFCGenerator, container: HTMLElement = document.body) {
    this.generator = generator;

    // Initialize with generator's current dimensions if available
    const dims = this.generator.getDimensions();
    if (dims.width > 0) this.currentWidth = dims.width;
    if (dims.height > 0) this.currentHeight = dims.height;
    if (dims.depth > 0) this.currentDepth = dims.depth;

    // Inject custom styles once
    if (!DebugUI.stylesInjected) {
      this.injectCustomStyles();
      DebugUI.stylesInjected = true;
    }

    this.gui = new GUI({
      width: 300,
      container: container,
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
    const previousWidth = this.currentWidth;
    const previousHeight = this.currentHeight;
    const previousDepth = this.currentDepth;

    // Update internal state
    if (dimension === "width") this.currentWidth = value;
    if (dimension === "height") this.currentHeight = value;
    if (dimension === "depth") this.currentDepth = value;

    // Handle auto-expand/shrink
    if (this.generator.canExpand()) {
      const newWidth = this.currentWidth;
      const newHeight = this.currentHeight;
      const newDepth = this.currentDepth;

      const widthIncreased = newWidth > previousWidth;
      const heightIncreased = newHeight > previousHeight;
      const depthIncreased = newDepth > previousDepth;

      const widthDecreased = newWidth < previousWidth;
      const heightDecreased = newHeight < previousHeight;
      const depthDecreased = newDepth < previousDepth;

      const anySizeIncreased =
        widthIncreased || heightIncreased || depthIncreased;
      const anySizeDecreased =
        widthDecreased || heightDecreased || depthDecreased;

      if (anySizeDecreased && !anySizeIncreased) {
        setTimeout(async () => {
          await this.generator.shrink(newWidth, newHeight, newDepth);
        }, 500);
      } else if (anySizeIncreased && !anySizeDecreased) {
        setTimeout(async () => {
          await this.generator.expand(newWidth, newHeight, newDepth);
        }, 500);
      } else if (anySizeIncreased && anySizeDecreased) {
        setTimeout(async () => {
          await this.generator.shrink(newWidth, newHeight, newDepth);
          await this.generator.expand(newWidth, newHeight, newDepth);
        }, 500);
      }
    }
  }

  /**
   * Create grid dimension controls
   */
  private createGridControls(): GUI {
    const gridFolder = this.gui.addFolder("Grid Dimensions");

    const params = {
      width: this.currentWidth,
      height: this.currentHeight,
      depth: this.currentDepth,
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

    // Cell Size control (default range: 0.1-10)
    const cellSizeParams = {
      cellSize: this.generator.getCellSize(),
    };

    gridFolder
      .add(cellSizeParams, "cellSize", 0.1, 10, 0.1)
      .name("cell size")
      .onChange((value: number) => {
        this.generator.setCellSize(value);
      });

    // Auto-expand mode control
    const expansionParams = {
      autoExpand: (this.generator as any).autoExpansion || false,
    };

    gridFolder
      .add(expansionParams, "autoExpand")
      .name("Auto-expand Mode")
      .onChange((value: boolean) => {
        (this.generator as any).autoExpansion = value;

        // Reset generator state when disabling expansion mode
        if (!value) {
          this.generator.reset();
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
      seed: this.generator.getSeed(),
      generate: async () => {
        // Use internal UI state for dimensions
        await this.generator.collapse();
      },
      randomSeed: () => {
        const newSeed = Date.now();
        params.seed = newSeed;
        seedController.updateDisplay();
        this.generator.setSeed(newSeed);
      },
      reset: () => {
        this.generator.reset();
      },
    };

    const seedController = this.gui
      .add(params, "seed")
      .name("Seed")
      .onChange((value: number) => {
        this.generator.setSeed(value);
      });

    this.gui.add(params, "randomSeed").name("Random Seed");
    this.gui.add(params, "generate").name("Generate");
    this.gui.add(params, "reset").name("Reset");
  }

  /**
   * Create worker controls
   */
  private createWorkerControls(): void {
    const workerFolder = this.gui.addFolder("Workers");

    const workerParams = {
      workerCount:
        (this.generator as any).workerCount ||
        navigator.hardwareConcurrency ||
        4,
    };

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
        (this.generator as any).workerCount = value;
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
        this.generator.setDebugGridVisible(value);
      });
  }

  /**
   * Create tileset editor
   */
  private createTilesetEditor(): TilesetEditorElements | undefined {
    return createTilesetEditor({
      tiles: (this.generator as any).tiles || [],
      parentGUI: this.gui,
      onTransformChange: (tileId: string, transform: TileTransform) => {
        this.generator.updateTileTransform(tileId, {
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

  showProgress(message: string = "Generating..."): void {
    if (this.progressElement) {
      this.progressElement.style.display = "block";
      const label = this.progressElement.querySelector(".progress-label");
      if (label) {
        label.textContent = message;
      }
    }
  }

  /**
   * Updates the progress bar percentage
   */
  setProgress(percent: number): void {
    if (this.progressElement) {
      const fill = this.progressElement.querySelector(
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
  setProgressColor(color: string): void {
    if (this.progressElement) {
      const fill = this.progressElement.querySelector(
        ".progress-fill"
      ) as HTMLElement;
      if (fill) {
        fill.style.backgroundColor = color;
      }
    }
  }

  /**
   * Hides the progress bar
   */
  hideProgress(): void {
    if (this.progressElement) {
      this.progressElement.style.display = "none";
    }
  }
}
