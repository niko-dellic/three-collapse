/**
 * Shared UI components for WFC demos using lil-gui
 */
import GUI from "lil-gui";
import * as THREE from "three";
import type { WFCGenerator } from "../generators/WFCGenerator";
import {
  createTilesetEditor,
  type TilesetEditorElements,
} from "./TilesetEditor";
import debugUIStyles from "./debugUI.css?inline";
import type { Controller } from "lil-gui";
import type { TileTransform } from "./TilesetEditor";

/**
 * Debug UI class for WFC demos
 */

export class DebugUI {
  public gui: GUI;
  public generateFolder: GUI;
  public progressElement: HTMLDivElement;
  public tilesetEditor?: TilesetEditorElements;
  public generator: WFCGenerator;

  private static stylesInjected = false;
  private localExpansionControllers: {
    cellX: Controller;
    cellY: Controller;
    cellZ: Controller;
    updateLimits: () => void;
  } | null = null;
  private dimensionChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private isExpandInProgress: boolean = false;

  constructor(generator: WFCGenerator, container: HTMLElement = document.body) {
    this.generator = generator;

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

    this.generateFolder = this.createGenerateControls();
    this.createWorkerControls();
    this.createDebugControls();
    this.createLocalExpansionControls();
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
   * Uses debouncing to prevent rapid expand requests
   */
  private async handleDimensionChange(
    _dimension: "width" | "height" | "depth",
    _value: number
  ): Promise<void> {
    // Update local expansion slider limits immediately
    if (this.localExpansionControllers)
      this.localExpansionControllers.updateLimits();

    // Cancel any pending dimension change operation
    if (this.dimensionChangeTimeout) {
      clearTimeout(this.dimensionChangeTimeout);
      this.dimensionChangeTimeout = null;
    }

    // Debounce the expand operation (wait 500ms after last change)
    this.dimensionChangeTimeout = setTimeout(async () => {
      // Don't proceed if an expand is already in progress
      if (this.isExpandInProgress) {
        console.log("Expand already in progress, skipping dimension change");
        return;
      }

      // Handle auto-expand/shrink
      if (this.generator.canExpand()) {
        const newDimensions = this.generator.getDimensions();
        const { width, height, depth } = newDimensions;

        try {
          this.isExpandInProgress = true;
          console.log(`Auto-expanding to ${width}x${height}x${depth}...`);
          await this.generator.expand(width, height, depth);
          console.log("Auto-expand complete");
        } catch (error) {
          console.error("Auto-expand failed:", error);
        } finally {
          this.isExpandInProgress = false;
        }
      }
    }, 500); // 500ms debounce delay
  }

  /**
   * Create grid dimension controls
   */
  private createGenerateControls(): GUI {
    const generateFolder = this.gui.addFolder("Generate");

    // Width control (default range: 5-30)
    generateFolder
      .add(this.generator, "width" as keyof WFCGenerator, 5, 30, 1)
      .onChange((value: number) => {
        this.handleDimensionChange("width", value);
      })
      .listen();

    // Height control (default range: 1-20)
    generateFolder
      .add(this.generator, "height" as keyof WFCGenerator, 1, 20, 1)
      .onChange((value: number) => {
        this.handleDimensionChange("height", value);
      })
      .listen();

    // Depth control (default range: 5-30)
    generateFolder
      .add(this.generator, "depth" as keyof WFCGenerator, 5, 30, 1)
      .onChange((value: number) => {
        this.handleDimensionChange("depth", value);
      })
      .listen();

    // Cell Size control (default range: 0.1-10)
    const cellSizeParams = {
      cellSize: this.generator.getCellSize(),
    };

    generateFolder
      .add(cellSizeParams, "cellSize", 0.1, 10, 0.1)
      .name("cell size")
      .onChange((value: number) => {
        this.generator.setCellSize(value);
      });

    const workerParams = {
      workerCount: this.generator.getWorkerCount(),
    };

    const maxWorkers = navigator.hardwareConcurrency || 8;
    generateFolder
      .add(workerParams, "workerCount", 1, maxWorkers, 1)
      .name(`Workers (max: ${maxWorkers})`)
      .onChange((value: number) => {
        this.generator.setWorkerCount(value);
      });

    const generateParams = {
      seed: this.generator.getSeed(),
      generate: async () => {
        // Use internal UI state for dimensions
        await this.generator.generate();
      },
      randomSeed: () => {
        const newSeed = Date.now();
        generateParams.seed = newSeed;
        seedController.updateDisplay();
        this.generator.setSeed(newSeed);
      },
      reset: () => {
        this.generator.reset();
      },
    };

    const seedController = generateFolder
      .add(generateParams, "seed")
      .name("Seed")
      .onChange((value: number) => {
        this.generator.setSeed(value);
      });

    generateFolder.add(generateParams, "randomSeed").name("Random Seed");
    generateFolder.add(generateParams, "generate").name("Generate");
    generateFolder.add(generateParams, "reset").name("Reset");

    generateFolder.open();
    return generateFolder;
  }

  /**
   * Create worker controls
   */
  private createWorkerControls(): void {}

  /**
   * Create debug controls
   */
  private createDebugControls(): void {
    const debugFolder = this.gui.addFolder("Debug");

    const debugParams = {
      wireframe: this.generator.getDebugGrid()?.isVisible() || false,
    };

    debugFolder
      .add(debugParams, "wireframe")
      .name("Show Wireframe Grid")
      .onChange((value: boolean) => {
        this.generator.setDebugGridVisible(value);
      });
  }

  /**
   * Create local expansion controls
   */
  private createLocalExpansionControls(): void {
    const localExpFolder = this.gui.addFolder("Local Expansion");

    // Get actual grid bounds from sparse map
    // Add buffer for expansion beyond current grid
    const bounds = this.generator.getGridBounds();
    const bufferX = Math.max(
      10,
      Math.ceil((bounds.maxX - bounds.minX + 1) * 0.5)
    );
    const bufferY = Math.max(
      10,
      Math.ceil((bounds.maxY - bounds.minY + 1) * 0.5)
    );
    const bufferZ = Math.max(
      10,
      Math.ceil((bounds.maxZ - bounds.minZ + 1) * 0.5)
    );

    // Allow negative indices for backward expansion
    const minX = bounds.minX - bufferX;
    const maxX = bounds.maxX + bufferX;
    const minY = bounds.minY - bufferY;
    const maxY = bounds.maxY + bufferY;
    const minZ = bounds.minZ - bufferZ;
    const maxZ = bounds.maxZ + bufferZ;

    const params = {
      cellX: 0,
      cellY: 0,
      cellZ: 0,
      expansionX: 5,
      expansionY: 3,
      expansionZ: 5,
      previewEnabled: false,
      validateCell: () => {
        const isOnPeriphery = (this.generator as any).isCellOnPeriphery?.(
          params.cellX,
          params.cellY,
          params.cellZ
        );
        if (isOnPeriphery === undefined) {
          alert("Cell validation not available");
        } else if (isOnPeriphery) {
          alert(
            `Cell (${params.cellX}, ${params.cellY}, ${params.cellZ}) is on periphery ✓`
          );
        } else {
          alert(
            `Cell (${params.cellX}, ${params.cellY}, ${params.cellZ}) is NOT on periphery ✗`
          );
        }
      },
      expandFromCell: async () => {
        try {
          await this.generator.expandFromCell(
            params.cellX,
            params.cellY,
            params.cellZ,
            params.expansionX,
            params.expansionY,
            params.expansionZ
          );
          console.log("Expanded from cell successfully");
          // Update preview after expansion (will show new potential expansion cells)
          updatePreview();
        } catch (error) {
          console.error("Failed to expand from cell:", error);
          alert(`Error: ${(error as Error).message}`);
        }
      },
      deleteFromCell: async () => {
        try {
          await this.generator.deleteFromCell(
            params.cellX,
            params.cellY,
            params.cellZ,
            params.expansionX,
            params.expansionY,
            params.expansionZ
          );
          console.log("Deleted from cell successfully");
          // Update preview after deletion
          updatePreview();
        } catch (error) {
          console.error("Failed to delete from cell:", error);
          alert(`Error: ${(error as Error).message}`);
        }
      },
    };

    // Helper function to update preview
    const updatePreview = () => {
      const debugGrid = this.generator.getDebugGrid();
      if (!debugGrid) return;

      if (params.previewEnabled) {
        const previewCells = this.generator.getExpansionPreview(
          params.cellX,
          params.cellY,
          params.cellZ,
          params.expansionX,
          params.expansionY,
          params.expansionZ
        );

        if (previewCells.length === 0) {
          debugGrid.clearExpansionPreview();
        } else {
          debugGrid.showExpansionPreview(previewCells);
        }
      } else {
        debugGrid.clearExpansionPreview();
      }
    };

    // Helper function to update cell highlight and preview
    const updateHighlight = () => {
      const debugGrid = this.generator.getDebugGrid();
      if (debugGrid) {
        debugGrid.highlightCell(params.cellX, params.cellY, params.cellZ);
        // Update preview when coordinates change (if enabled)
        updatePreview();
      }
    };

    // Cell coordinate controls with highlight update
    const cellXController = localExpFolder
      .add(params, "cellX", minX, maxX, 1)
      .name("Cell X")
      .onChange(() => updateHighlight());

    const cellYController = localExpFolder
      .add(params, "cellY", minY, maxY, 1)
      .name("Cell Y")
      .onChange(() => updateHighlight());

    const cellZController = localExpFolder
      .add(params, "cellZ", minZ, maxZ, 1)
      .name("Cell Z")
      .onChange(() => updateHighlight());

    localExpFolder
      .add(params, "expansionX", 1, 20, 1)
      .name("Expansion X")
      .onChange(() => updatePreview());
    localExpFolder
      .add(params, "expansionY", 1, 20, 1)
      .name("Expansion Y")
      .onChange(() => updatePreview());
    localExpFolder
      .add(params, "expansionZ", 1, 20, 1)
      .name("Expansion Z")
      .onChange(() => updatePreview());
    localExpFolder.add(params, "validateCell").name("Validate Cell");
    localExpFolder
      .add(params, "previewEnabled")
      .name("Preview Expansion")
      .onChange(() => updatePreview());
    localExpFolder.add(params, "expandFromCell").name("Expand From Cell");
    localExpFolder.add(params, "deleteFromCell").name("Delete From Cell");

    // Initialize highlight
    updateHighlight();

    // Store controllers for later updates (if grid dimensions change)
    this.localExpansionControllers = {
      cellX: cellXController,
      cellY: cellYController,
      cellZ: cellZController,
      updateLimits: () => {
        const newBounds = this.generator.getGridBounds();
        const newBufferX = Math.max(
          10,
          Math.ceil((newBounds.maxX - newBounds.minX + 1) * 0.5)
        );
        const newBufferY = Math.max(
          10,
          Math.ceil((newBounds.maxY - newBounds.minY + 1) * 0.5)
        );
        const newBufferZ = Math.max(
          10,
          Math.ceil((newBounds.maxZ - newBounds.minZ + 1) * 0.5)
        );

        // Allow negative indices for backward expansion
        const newMinX = newBounds.minX - newBufferX;
        const newMaxX = newBounds.maxX + newBufferX;
        const newMinY = newBounds.minY - newBufferY;
        const newMaxY = newBounds.maxY + newBufferY;
        const newMinZ = newBounds.minZ - newBufferZ;
        const newMaxZ = newBounds.maxZ + newBufferZ;

        // Update controller limits
        cellXController.min(newMinX).max(newMaxX);
        cellYController.min(newMinY).max(newMaxY);
        cellZController.min(newMinZ).max(newMaxZ);
      },
    };
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
