/**
 * Shared UI components for WFC demos
 */

export interface SliderConfig {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export interface DemoUIConfig {
  title: string;
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
}

export interface DemoUIElements {
  container: HTMLDivElement;
  gridInfo: HTMLDivElement;
  seedInput: HTMLInputElement;
  generateBtn: HTMLButtonElement;
  randomBtn: HTMLButtonElement;
  progressContainer: HTMLDivElement;
  progressFill: HTMLDivElement;
}

/**
 * Creates a slider control with label and value display
 */
export function createSlider(config: SliderConfig): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "slider-container";

  const labelRow = document.createElement("div");
  labelRow.className = "slider-label-row";

  const labelEl = document.createElement("label");
  labelEl.textContent = config.label;
  labelRow.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "slider-value";
  valueEl.textContent = config.value.toString();
  labelRow.appendChild(valueEl);

  container.appendChild(labelRow);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = config.min.toString();
  slider.max = config.max.toString();
  slider.value = config.value.toString();
  slider.addEventListener("input", () => {
    const newValue = parseInt(slider.value);
    valueEl.textContent = newValue.toString();
    config.onChange(newValue);
  });

  container.appendChild(slider);
  return container;
}

/**
 * Creates the standard demo UI
 */
export function createDemoUI(config: DemoUIConfig): DemoUIElements {
  // Create UI container
  const uiContainer = document.createElement("div");
  uiContainer.className = "ui-container";
  document.body.appendChild(uiContainer);

  // Title
  const title = document.createElement("h2");
  title.className = "ui-title";
  title.textContent = config.title;
  uiContainer.appendChild(title);

  // Grid info
  const gridInfo = document.createElement("div");
  gridInfo.className = "grid-info";
  gridInfo.textContent = `Grid: ${config.width}×${config.height}×${config.depth}`;
  uiContainer.appendChild(gridInfo);

  // Grid size controls
  const gridControlsTitle = document.createElement("div");
  gridControlsTitle.className = "section-title";
  gridControlsTitle.textContent = "Grid Size";
  uiContainer.appendChild(gridControlsTitle);

  // Width slider
  const widthRange = config.widthRange || { min: 5, max: 50 };
  const widthContainer = createSlider({
    label: "Width",
    value: config.width,
    min: widthRange.min,
    max: widthRange.max,
    onChange: (value) => {
      gridInfo.textContent = `Grid: ${value}×${config.height}×${config.depth}`;
      config.onWidthChange(value);
    },
  });
  uiContainer.appendChild(widthContainer);

  // Height slider
  const heightRange = config.heightRange || { min: 1, max: 20 };
  const heightContainer = createSlider({
    label: "Height",
    value: config.height,
    min: heightRange.min,
    max: heightRange.max,
    onChange: (value) => {
      gridInfo.textContent = `Grid: ${config.width}×${value}×${config.depth}`;
      config.onHeightChange(value);
    },
  });
  uiContainer.appendChild(heightContainer);

  // Depth slider
  const depthRange = config.depthRange || { min: 5, max: 50 };
  const depthContainer = createSlider({
    label: "Depth",
    value: config.depth,
    min: depthRange.min,
    max: depthRange.max,
    onChange: (value) => {
      gridInfo.textContent = `Grid: ${config.width}×${config.height}×${value}`;
      config.onDepthChange(value);
    },
  });
  uiContainer.appendChild(depthContainer);

  // Separator
  const separator = document.createElement("hr");
  uiContainer.appendChild(separator);

  // Seed input
  const seedContainer = document.createElement("div");
  seedContainer.className = "seed-container";

  const seedLabel = document.createElement("label");
  seedLabel.className = "seed-label";
  seedLabel.textContent = "Seed: ";
  seedContainer.appendChild(seedLabel);

  const seedInput = document.createElement("input");
  seedInput.className = "seed-input";
  seedInput.type = "number";
  seedInput.value = config.seed.toString();
  seedInput.addEventListener("change", () => {
    const seed = parseInt(seedInput.value) || Date.now();
    config.onSeedChange(seed);
  });
  seedContainer.appendChild(seedInput);

  uiContainer.appendChild(seedContainer);

  // Generate button
  const generateBtn = document.createElement("button");
  generateBtn.textContent = "Generate";
  generateBtn.addEventListener("click", config.onGenerate);
  uiContainer.appendChild(generateBtn);

  // Random seed button
  const randomBtn = document.createElement("button");
  randomBtn.textContent = "Random Seed";
  randomBtn.addEventListener("click", () => {
    const newSeed = Date.now();
    seedInput.value = newSeed.toString();
    config.onRandomSeed();
  });
  uiContainer.appendChild(randomBtn);

  // Progress container
  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";

  const progressLabel = document.createElement("div");
  progressLabel.className = "progress-label";
  progressLabel.textContent = "Generating...";
  progressContainer.appendChild(progressLabel);

  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";

  const progressFill = document.createElement("div");
  progressFill.className = "progress-fill";
  progressBar.appendChild(progressFill);

  progressContainer.appendChild(progressBar);
  uiContainer.appendChild(progressContainer);

  return {
    container: uiContainer,
    gridInfo,
    seedInput,
    generateBtn,
    randomBtn,
    progressContainer,
    progressFill,
  };
}

/**
 * Updates the grid info text
 */
export function updateGridInfo(
  gridInfo: HTMLDivElement,
  width: number,
  height: number,
  depth: number
): void {
  gridInfo.textContent = `Grid: ${width}×${height}×${depth}`;
}

/**
 * Shows progress bar with a given progress (0-1)
 */
export function showProgress(
  progressContainer: HTMLDivElement,
  progressFill: HTMLDivElement,
  progress: number
): void {
  progressContainer.classList.add("visible");
  progressFill.style.width = `${progress * 100}%`;
}

/**
 * Hides progress bar
 */
export function hideProgress(progressContainer: HTMLDivElement): void {
  progressContainer.classList.remove("visible");
}

/**
 * Sets button enabled state
 */
export function setButtonEnabled(
  button: HTMLButtonElement,
  enabled: boolean
): void {
  button.disabled = !enabled;
}
