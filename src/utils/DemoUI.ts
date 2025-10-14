/**
 * Shared UI components for WFC demos using lil-gui
 */
import GUI from "lil-gui";

export interface DemoUIConfig {
  title?: string;
  width: number;
  height: number;
  depth: number;
  seed: number;
  onGenerate: () => void;
  onRandomSeed: () => void;
  onSeedChange: (seed: number) => void;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onDepthChange: (depth: number) => void;
  widthRange?: { min: number; max: number };
  heightRange?: { min: number; max: number };
  depthRange?: { min: number; max: number };
  // Optional expansion and worker controls
  showExpansionToggle?: boolean;
  expansionMode?: boolean;
  onExpansionChange?: (enabled: boolean) => void;
  showWorkerControls?: boolean;
  useWorkers?: boolean;
  workerCount?: number;
  onUseWorkersChange?: (enabled: boolean) => void;
  onWorkerCountChange?: (count: number) => void;
  // Optional debug controls
  showDebugControls?: boolean;
  debugWireframe?: boolean;
  onDebugWireframeChange?: (enabled: boolean) => void;
}

export interface DemoUIElements {
  gui: GUI;
  gridFolder: GUI;
  progressElement?: HTMLDivElement;
}

/**
 * Creates the demo UI using lil-gui
 */
export function createDemoUI(config: DemoUIConfig): DemoUIElements {
  const gui = new GUI({
    title: config.title || "WFC Demo",
    width: 300,
  });

  gui.domElement.style.right = "0px";

  // Create a parameters object that lil-gui can bind to
  const params = {
    width: config.width,
    height: config.height,
    depth: config.depth,
    seed: config.seed,
    generate: config.onGenerate,
    randomSeed: () => {
      params.seed = Date.now();
      seedController.updateDisplay();
      config.onRandomSeed();
      config.onSeedChange(params.seed);
    },
  };

  // Grid dimensions folder
  const gridFolder = gui.addFolder("Grid Dimensions");

  gridFolder
    .add(
      params,
      "width",
      config.widthRange?.min ?? 5,
      config.widthRange?.max ?? 30,
      1
    )
    .onChange((value: number) => {
      config.onWidthChange(value);
    });

  gridFolder
    .add(
      params,
      "height",
      config.heightRange?.min ?? 1,
      config.heightRange?.max ?? 20,
      1
    )
    .onChange((value: number) => {
      config.onHeightChange(value);
    });

  gridFolder
    .add(
      params,
      "depth",
      config.depthRange?.min ?? 5,
      config.depthRange?.max ?? 30,
      1
    )
    .onChange((value: number) => {
      config.onDepthChange(value);
    });

  gridFolder.open();

  // Generation controls
  const seedController = gui
    .add(params, "seed")
    .name("Seed")
    .onChange((value: number) => {
      config.onSeedChange(value);
    });

  gui.add(params, "randomSeed").name("Random Seed");
  gui.add(params, "generate").name("Generate");

  // Expansion mode (optional)
  if (config.showExpansionToggle && config.onExpansionChange) {
    const expansionParams = {
      autoExpand: config.expansionMode ?? false,
    };

    gui
      .add(expansionParams, "autoExpand")
      .name("Auto-expand Mode")
      .onChange((value: boolean) => {
        config.onExpansionChange!(value);
      });
  }

  // Worker controls (optional)
  if (config.showWorkerControls) {
    const workerFolder = gui.addFolder("Workers");

    const workerParams = {
      useWorkers: config.useWorkers ?? true,
      workerCount: config.workerCount ?? (navigator.hardwareConcurrency || 4),
    };

    workerFolder
      .add(workerParams, "useWorkers")
      .name("Enable Multi-worker")
      .onChange((value: boolean) => {
        if (config.onUseWorkersChange) {
          config.onUseWorkersChange(value);
        }
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
        if (config.onWorkerCountChange) {
          config.onWorkerCountChange(value);
        }
      });

    workerFolder.open();
  }

  // Debug controls (optional)
  if (config.showDebugControls) {
    const debugFolder = gui.addFolder("Debug");

    const debugParams = {
      wireframe: config.debugWireframe ?? false,
    };

    debugFolder
      .add(debugParams, "wireframe")
      .name("Show Wireframe Grid")
      .onChange((value: boolean) => {
        if (config.onDebugWireframeChange) {
          config.onDebugWireframeChange(value);
        }
      });

    debugFolder.open();
  }

  // Create progress element (styled manually since lil-gui doesn't have progress bars)
  const progressElement = createProgressElement();
  gui.domElement.appendChild(progressElement);

  return {
    gui,
    gridFolder,
    progressElement,
  };
}

/**
 * Creates a progress bar element to append to the GUI
 */
function createProgressElement(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "progress-container";
  container.style.cssText = `
    padding: 8px;
    margin-top: 8px;
    display: none;
  `;

  const label = document.createElement("div");
  label.className = "progress-label";
  label.textContent = "Generating...";
  label.style.cssText = `
    font-size: 11px;
    margin-bottom: 4px;
    font-family: inherit;
  `;

  const barContainer = document.createElement("div");
  barContainer.className = "progress-bar";
  barContainer.style.cssText = `
    width: 100%;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
    overflow: hidden;
  `;

  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.cssText = `
    width: 0%;
    height: 100%;
    background-color: var(--focus-color);
    transition: width 0.2s ease, background-color 0.3s ease;
  `;

  barContainer.appendChild(fill);
  container.appendChild(label);
  container.appendChild(barContainer);

  return container;
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
