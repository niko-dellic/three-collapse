import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import JSConfetti from "js-confetti";
import SpriteText from "three-spritetext";
import type { ModelTile3DConfig } from "../wfc3d";
import "./AdjacencyBuilderUI.css";

export interface TilePair {
  tileA: string;
  tileB: string;
}

export interface AdjacencyData {
  up: Set<string>;
  down: Set<string>;
  north: Set<string>;
  south: Set<string>;
  east: Set<string>;
  west: Set<string>;
}

export interface TileData {
  id: string;
  model: string | (() => THREE.Object3D);
  weight: number;
  adjacency: AdjacencyData;
  object?: THREE.Object3D;
}

const OPPOSITE_DIRECTIONS: { [key: string]: string } = {
  up: "down",
  down: "up",
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

/**
 * Configuration options for AdjacencyBuilderUI
 */
export interface AdjacencyBuilderConfig {
  container?: HTMLElement;
  existingTileset?: ModelTile3DConfig[];
  onExportJSON?: (json: string) => void;
  onExportGLB?: (blob: Blob) => void;
}

/**
 * Visual Adjacency Builder Tool
 *
 * A complete UI for building tile adjacency rules with 3D preview.
 *
 * @example
 * ```typescript
 * import { AdjacencyBuilderUI } from "three-collapse";
 *
 * const builder = new AdjacencyBuilderUI({
 *   container: document.body,
 *   onExportJSON: (json) => {
 *     console.log("Exported:", json);
 *   }
 * });
 * ```
 */
export class AdjacencyBuilderUI {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private glbLoader: GLTFLoader;
  private jsConfetti: JSConfetti;

  private tiles: Map<string, TileData> = new Map();
  private reviewedPairs: Set<string> = new Set();
  private allPairs: TilePair[] = [];
  private currentPairIndex: number = 0;
  private currentDirection: number = 0;

  private tileAObject: THREE.Group | null = null;
  private tileBObject: THREE.Group | null = null;
  private labelA: SpriteText | null = null;
  private labelB: SpriteText | null = null;
  private showLabels = false;

  private uiContainer!: HTMLDivElement;
  private config: AdjacencyBuilderConfig;

  // Direction constants
  private readonly DIRECTIONS = [
    "up",
    "down",
    "north",
    "south",
    "east",
    "west",
  ];
  private readonly DIRECTION_LABELS = [
    "Up",
    "Down",
    "North",
    "South",
    "East",
    "West",
  ];
  private readonly DIRECTION_OFFSETS: { [key: string]: THREE.Vector3 } = {
    up: new THREE.Vector3(0, 2, 0),
    down: new THREE.Vector3(0, -2, 0),
    north: new THREE.Vector3(0, 0, 2),
    south: new THREE.Vector3(0, 0, -2),
    east: new THREE.Vector3(2, 0, 0),
    west: new THREE.Vector3(-2, 0, 0),
  };

  // UI Elements (will be created programmatically)
  private pickDirectoryBtn!: HTMLButtonElement;
  private fileUpload!: HTMLInputElement;
  private startBtn!: HTMLButtonElement;

  // File System Access API support
  private directoryHandle: any = null; // FileSystemDirectoryHandle
  private fileHandles: Map<string, any> = new Map(); // Map of tileId -> FileSystemFileHandle
  private builderSection!: HTMLDivElement;
  private progressText!: HTMLSpanElement;
  private tileAName!: HTMLSpanElement;
  private tileBName!: HTMLSpanElement;
  private directionText!: HTMLSpanElement;
  private yesBtn!: HTMLButtonElement;
  private noBtn!: HTMLButtonElement;
  private yesAllBtn!: HTMLButtonElement;
  private noAllBtn!: HTMLButtonElement;
  private autoCenterToggle!: HTMLInputElement;
  private showLabelsToggle!: HTMLInputElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private skipPairBtn!: HTMLButtonElement;
  private pairNavContainer!: HTMLDivElement;
  private manageWeightsBtn!: HTMLButtonElement;
  private weightsPanel!: HTMLDivElement;
  private reviewList!: HTMLDivElement;
  private exportJsonBtn!: HTMLButtonElement;
  private exportGlbBtn!: HTMLButtonElement;
  private loadingOverlay!: HTMLDivElement;

  constructor(config: AdjacencyBuilderConfig = {}) {
    this.config = config;

    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 15, 40);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = config.container || document.body;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(3);
    this.scene.add(axesHelper);

    this.glbLoader = new GLTFLoader();
    this.jsConfetti = new JSConfetti();

    // Create UI
    this.createUI();
    this.setupEventListeners();

    // Start animation loop
    this.animate();

    // Handle resize
    window.addEventListener("resize", () => this.handleResize());
  }

  private createUI(): void {
    // Create UI container
    this.uiContainer = document.createElement("div");
    this.uiContainer.id = "adjacency-ui";
    document.body.appendChild(this.uiContainer);

    // Build UI structure
    this.uiContainer.innerHTML = `
      <h2>Adjacency Builder</h2>
      
      <div class="section">
        <h3>Load GLB Files</h3>
        <button id="pick-directory-btn" style="margin-bottom: 10px">📁 Pick Directory (recommended)</button>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 15px">
          Saves back to same folder when exporting
        </div>
        
        
        <div class="file-upload-wrapper">
          <input type="file" id="file-upload" multiple accept=".glb" />
          <label for="file-upload" class="file-upload-label">
            📄 Upload GLB Files
          </label>
          <div class="file-upload-info" id="file-upload-info">Falls back to download</div>
        </div>
        
        <button id="start-btn" style="margin-top: 10px">Start</button>
      </div>

      <div id="builder-section" style="display: none">
        <div class="progress">
          <span id="progress-text">Pair 0 / 0</span><br />
          <span id="direction-text" style="font-size: 13px; color: #60a5fa">Direction: Up</span>
        </div>

        <div class="tile-info">
          <div><strong>Tile A:</strong> <span id="tile-a-name">-</span></div>
          <div><strong>Tile B:</strong> <span id="tile-b-name">-</span></div>
        </div>

        <div style="margin: 15px 0">
          <button id="yes-btn" class="yes-btn">✓ Yes</button>
          <button id="no-btn" class="no-btn">✗ No</button>
          <button id="yes-all-btn" class="yes-btn btn-small">✓✓ Yes to All</button>
          <button id="no-all-btn" class="no-btn btn-small">✗✗ No to All</button>
        </div>

        <div style="margin: 15px 0; font-size: 12px">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
            <input type="checkbox" id="auto-center-toggle" checked />
            Auto-center objects at origin
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 8px">
            <input type="checkbox" id="show-labels-toggle" />
            Show tile labels
          </label>
        </div>

        <div style="margin-top: 15px">
          <button id="prev-btn">← Previous</button>
          <button id="next-btn">Next →</button>
          <button id="skip-pair-btn">Skip Pair</button>
        </div>

        <h3>Tiles</h3>
        <div class="pair-navigation" id="pair-nav"></div>

        <h3>Tile Weights</h3>
        <button id="manage-weights-btn">Manage Tile Weights</button>
        <div id="weights-panel" style="display: none; margin-top: 10px; max-height: 200px; overflow-y: auto"></div>

        <h3>Review & Export</h3>
        <div class="review-list" id="review-list"></div>

        <div style="margin-top: 15px">
          <button id="export-json-btn">Export JSON (Reference)</button>
          <button id="export-glb-btn">Save GLB Files</button>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
            GLB: Saves to folder or downloads individually
          </div>
        </div>
      </div>
    `;

    // Create loading overlay
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.id = "loading-overlay";
    this.loadingOverlay.innerHTML = "<div>Loading models...</div>";
    document.body.appendChild(this.loadingOverlay);

    // Get references to UI elements
    this.pickDirectoryBtn = document.getElementById(
      "pick-directory-btn"
    ) as HTMLButtonElement;
    this.fileUpload = document.getElementById(
      "file-upload"
    ) as HTMLInputElement;
    this.startBtn = document.getElementById("start-btn") as HTMLButtonElement;
    this.builderSection = document.getElementById(
      "builder-section"
    ) as HTMLDivElement;
    this.progressText = document.getElementById(
      "progress-text"
    ) as HTMLSpanElement;
    this.tileAName = document.getElementById("tile-a-name") as HTMLSpanElement;
    this.tileBName = document.getElementById("tile-b-name") as HTMLSpanElement;
    this.directionText = document.getElementById(
      "direction-text"
    ) as HTMLSpanElement;
    this.yesBtn = document.getElementById("yes-btn") as HTMLButtonElement;
    this.noBtn = document.getElementById("no-btn") as HTMLButtonElement;
    this.yesAllBtn = document.getElementById(
      "yes-all-btn"
    ) as HTMLButtonElement;
    this.noAllBtn = document.getElementById("no-all-btn") as HTMLButtonElement;
    this.autoCenterToggle = document.getElementById(
      "auto-center-toggle"
    ) as HTMLInputElement;
    this.showLabelsToggle = document.getElementById(
      "show-labels-toggle"
    ) as HTMLInputElement;
    this.prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
    this.nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
    this.skipPairBtn = document.getElementById(
      "skip-pair-btn"
    ) as HTMLButtonElement;
    this.pairNavContainer = document.getElementById(
      "pair-nav"
    ) as HTMLDivElement;
    this.manageWeightsBtn = document.getElementById(
      "manage-weights-btn"
    ) as HTMLButtonElement;
    this.weightsPanel = document.getElementById(
      "weights-panel"
    ) as HTMLDivElement;
    this.reviewList = document.getElementById("review-list") as HTMLDivElement;
    this.exportJsonBtn = document.getElementById(
      "export-json-btn"
    ) as HTMLButtonElement;
    this.exportGlbBtn = document.getElementById(
      "export-glb-btn"
    ) as HTMLButtonElement;
  }

  private setupEventListeners(): void {
    // Directory picker button
    this.pickDirectoryBtn.addEventListener("click", () =>
      this.handlePickDirectory()
    );

    // File upload change - update info text
    this.fileUpload.addEventListener("change", () => {
      const fileInfo = document.getElementById("file-upload-info");
      if (fileInfo) {
        const count = this.fileUpload.files?.length || 0;
        if (count === 0) {
          fileInfo.textContent = "Falls back to download";
        } else if (count === 1) {
          fileInfo.textContent = `1 file: ${this.fileUpload.files![0].name}`;
        } else {
          fileInfo.textContent = `${count} files selected`;
        }
      }
    });

    // Start button
    this.startBtn.addEventListener("click", () => this.handleStart());

    // Yes/No buttons
    this.yesBtn.addEventListener("click", () =>
      this.handleDirectionAnswer(true)
    );
    this.noBtn.addEventListener("click", () =>
      this.handleDirectionAnswer(false)
    );
    this.yesAllBtn.addEventListener("click", () =>
      this.handleAllDirections(true)
    );
    this.noAllBtn.addEventListener("click", () =>
      this.handleAllDirections(false)
    );

    // Toggles
    this.autoCenterToggle.addEventListener("change", () => {
      const pair = this.getCurrentPair();
      if (pair) {
        this.displayTilePair(pair, this.DIRECTIONS[this.currentDirection]);
      }
    });

    this.showLabelsToggle.addEventListener("change", () => {
      this.showLabels = this.showLabelsToggle.checked;
      if (this.labelA) this.labelA.visible = this.showLabels;
      if (this.labelB) this.labelB.visible = this.showLabels;
    });

    // Navigation
    this.prevBtn.addEventListener("click", () => this.handlePrevious());
    this.nextBtn.addEventListener("click", () => this.handleNext());
    this.skipPairBtn.addEventListener("click", () => this.handleSkipPair());

    // Weight management
    this.manageWeightsBtn.addEventListener("click", () =>
      this.toggleWeightsPanel()
    );

    // Export
    this.exportJsonBtn.addEventListener("click", () => this.handleExportJSON());
    this.exportGlbBtn.addEventListener("click", () => this.handleExportGLB());
  }

  private async handlePickDirectory(): Promise<void> {
    // Check if File System Access API is supported
    if (!("showDirectoryPicker" in window)) {
      alert(
        "Directory picking not supported in this browser. Please use file upload instead."
      );
      return;
    }

    try {
      // @ts-ignore - File System Access API
      this.directoryHandle = await window.showDirectoryPicker({
        mode: "readwrite", // Request write permission for later export
      });

      console.log(`Selected directory: ${this.directoryHandle.name}`);

      // Auto-start after directory selection
      await this.handleStart();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error picking directory:", error);
        alert("Error accessing directory. Check console for details.");
      }
    }
  }

  private async handleStart(): Promise<void> {
    try {
      this.loadingOverlay.classList.add("active");

      // Check if we have a directory handle or file upload
      if (this.directoryHandle) {
        // Load from directory
        await this.loadFromDirectory();
      } else if (this.fileUpload.files && this.fileUpload.files.length > 0) {
        // Load from uploaded files
        await this.loadFromUploadedFiles();
      } else {
        alert("Please pick a directory or upload GLB files first");
        this.loadingOverlay.classList.remove("active");
        return;
      }

      this.builderSection.style.display = "block";
      this.startBtn.disabled = true;
      this.pickDirectoryBtn.disabled = true;
      this.currentDirection = 0;

      this.generatePairNavigation();
      this.displayCurrentPair();
      this.updateReviewList();

      this.loadingOverlay.classList.remove("active");
    } catch (error) {
      console.error("Error initializing:", error);
      alert("Error loading models. Check console for details.");
      this.loadingOverlay.classList.remove("active");
    }
  }

  private async loadFromDirectory(): Promise<void> {
    const files: File[] = [];

    // @ts-ignore
    for await (const entry of this.directoryHandle.values()) {
      if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".glb")) {
        const fileHandle = await entry;
        const file = await fileHandle.getFile();
        files.push(file);

        // Store file handle for later export
        const filename = file.name.replace(/\.glb$/i, "");
        this.fileHandles.set(filename, fileHandle);
      }
    }

    console.log(`Found ${files.length} GLB files in directory`);

    // Load GLB files and check for existing userData
    await this.loadGLBFilesWithUserData(files);
  }

  private async loadFromUploadedFiles(): Promise<void> {
    if (!this.fileUpload.files) return;

    const files: File[] = Array.from(this.fileUpload.files);

    console.log(`Loading ${files.length} uploaded GLB files`);

    // Load GLB files and check for existing userData
    await this.loadGLBFilesWithUserData(files);
  }

  private async loadGLBFilesWithUserData(files: File[]): Promise<void> {
    this.tiles.clear();
    this.reviewedPairs.clear();
    this.allPairs = [];
    this.currentPairIndex = 0;

    // Load each GLB file and check for existing adjacency data
    for (const file of files) {
      const filename = file.name.replace(/\.glb$/i, "");

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Parse GLB
      await new Promise<void>((resolve, reject) => {
        this.glbLoader.parse(
          arrayBuffer,
          "",
          (gltf) => {
            const tile = gltf.scene.children[0];

            // Check for existing adjacency data in userData
            const userData = tile.userData.adjacencyData || tile.userData;

            const existingAdjacency: AdjacencyData = {
              up: new Set(userData.adjacency?.up || []),
              down: new Set(userData.adjacency?.down || []),
              north: new Set(userData.adjacency?.north || []),
              south: new Set(userData.adjacency?.south || []),
              east: new Set(userData.adjacency?.east || []),
              west: new Set(userData.adjacency?.west || []),
            };

            this.tiles.set(filename, {
              id: filename,
              model: URL.createObjectURL(file),
              weight: userData.weight || 1,
              adjacency: existingAdjacency,
              object: tile,
            });

            // If tile has adjacency data, mark relevant pairs as reviewed
            if (this.hasAnyAdjacency(existingAdjacency)) {
              console.log(`✓ Loaded existing adjacencies for: ${filename}`);
            }

            resolve();
          },
          (error) => reject(error)
        );
      });
    }

    // Generate all pairs
    this.generateAllPairs();

    // Mark pairs as reviewed if they have adjacencies
    const tileIds = Array.from(this.tiles.keys());
    for (let i = 0; i < tileIds.length; i++) {
      const tileA = this.tiles.get(tileIds[i])!;
      for (let j = i; j < tileIds.length; j++) {
        const tileB = this.tiles.get(tileIds[j])!;
        if (this.pairHasAdjacency(tileA, tileB)) {
          this.reviewedPairs.add(this.getPairKey(tileA.id, tileB.id));
        }
      }
    }

    console.log(
      `Loaded ${this.tiles.size} tiles, ${this.reviewedPairs.size} pairs already have adjacencies`
    );
  }

  private hasAnyAdjacency(adjacency: AdjacencyData): boolean {
    return Object.values(adjacency).some((set) => set.size > 0);
  }

  private pairHasAdjacency(tileA: TileData, tileB: TileData): boolean {
    for (const direction of Object.keys(
      tileA.adjacency
    ) as (keyof AdjacencyData)[]) {
      if (tileA.adjacency[direction].has(tileB.id)) return true;
    }
    for (const direction of Object.keys(
      tileB.adjacency
    ) as (keyof AdjacencyData)[]) {
      if (tileB.adjacency[direction].has(tileA.id)) return true;
    }
    return false;
  }

  private generateAllPairs(): void {
    const tileIds = Array.from(this.tiles.keys());
    for (let i = 0; i < tileIds.length; i++) {
      for (let j = i; j < tileIds.length; j++) {
        this.allPairs.push({ tileA: tileIds[i], tileB: tileIds[j] });
      }
    }
  }

  private getPairKey(tileA: string, tileB: string): string {
    return tileA <= tileB ? `${tileA}|${tileB}` : `${tileB}|${tileA}`;
  }

  private generatePairNavigation(): void {
    this.pairNavContainer.innerHTML = "";
    this.allPairs.forEach((pair, index) => {
      const btn = document.createElement("button");
      btn.className = "pair-nav-btn";
      btn.textContent = `${pair.tileA} ↔ ${pair.tileB}`;
      btn.onclick = () => {
        this.currentPairIndex = index;
        this.currentDirection = 0;
        this.displayCurrentPair();
      };

      if (this.isPairReviewed(index)) {
        btn.classList.add("complete");
      }

      this.pairNavContainer.appendChild(btn);
    });
  }

  private isPairReviewed(index: number): boolean {
    if (index < 0 || index >= this.allPairs.length) return false;
    const pair = this.allPairs[index];
    return this.reviewedPairs.has(this.getPairKey(pair.tileA, pair.tileB));
  }

  private getCurrentPair(): TilePair | null {
    if (
      this.currentPairIndex < 0 ||
      this.currentPairIndex >= this.allPairs.length
    ) {
      return null;
    }
    return this.allPairs[this.currentPairIndex];
  }

  private displayCurrentPair(): void {
    const pair = this.getCurrentPair();
    if (!pair) return;

    this.tileAName.textContent = pair.tileA;
    this.tileBName.textContent = pair.tileB;

    const progress = {
      current: this.currentPairIndex + 1,
      total: this.allPairs.length,
      reviewed: this.reviewedPairs.size,
    };

    this.progressText.textContent = `Pair ${progress.current} / ${progress.total} (${progress.reviewed} reviewed)`;

    const directionName = this.DIRECTION_LABELS[this.currentDirection];
    const isSelfPair = pair.tileA === pair.tileB;
    const directionCount = isSelfPair ? "3" : "6";

    this.directionText.textContent = `Direction: ${directionName} (${
      this.currentDirection + 1
    }/${directionCount})${isSelfPair ? " [Self-pair: symmetric]" : ""}`;

    this.displayTilePair(pair, this.DIRECTIONS[this.currentDirection]);
    this.updateNavigationButtons();
    this.updatePairNavigationHighlight();
  }

  private displayTilePair(pair: TilePair, direction: string): void {
    // Remove existing tiles and labels
    if (this.tileAObject) this.scene.remove(this.tileAObject);
    if (this.tileBObject) this.scene.remove(this.tileBObject);
    if (this.labelA) this.scene.remove(this.labelA);
    if (this.labelB) this.scene.remove(this.labelB);

    const tileA = this.tiles.get(pair.tileA);
    const tileB = this.tiles.get(pair.tileB);
    if (!tileA?.object || !tileB?.object) return;

    this.tileAObject = tileA.object.clone() as THREE.Group;
    this.tileBObject = tileB.object.clone() as THREE.Group;

    if (this.autoCenterToggle.checked) {
      this.centerObjectAtOrigin(this.tileAObject);
      this.centerObjectAtOrigin(this.tileBObject);
    } else {
      this.tileAObject.position.set(0, 0, 0);
    }

    const offset = this.DIRECTION_OFFSETS[direction];
    if (this.autoCenterToggle.checked) {
      this.tileBObject.position.add(offset);
    } else {
      this.tileBObject.position.copy(offset);
    }

    // Color tiles
    this.tileAObject.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.Material).clone();
          (mat as any).emissive = new THREE.Color(0x3333ff);
          (mat as any).emissiveIntensity = 0.3;
          (mat as any).side = THREE.DoubleSide;
          mesh.material = mat;
        }
      }
    });

    this.tileBObject.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.Material).clone();
          (mat as any).emissive = new THREE.Color(0xff3333);
          (mat as any).emissiveIntensity = 0.3;
          (mat as any).side = THREE.DoubleSide;
          mesh.material = mat;
        }
      }
    });

    this.scene.add(this.tileAObject);
    this.scene.add(this.tileBObject);

    // Add labels
    this.labelA = this.createSpriteTextLabel("A: " + pair.tileA, "#3333ff");
    this.labelB = this.createSpriteTextLabel("B: " + pair.tileB, "#ff3333");

    const boxA = new THREE.Box3().setFromObject(this.tileAObject);
    const boxB = new THREE.Box3().setFromObject(this.tileBObject);

    this.labelA.position.set(
      (boxA.min.x + boxA.max.x) / 2,
      boxA.max.y + 0.5,
      (boxA.min.z + boxA.max.z) / 2
    );
    this.labelB.position.set(
      (boxB.min.x + boxB.max.x) / 2,
      boxB.max.y + 0.5,
      (boxB.min.z + boxB.max.z) / 2
    );

    this.labelA.visible = this.showLabels;
    this.labelB.visible = this.showLabels;

    this.scene.add(this.labelA);
    this.scene.add(this.labelB);
  }

  private centerObjectAtOrigin(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
  }

  private createSpriteTextLabel(text: string, color: string): SpriteText {
    const label = new SpriteText(text, 0.3);
    (label as any).color = color;
    (label as any).backgroundColor = "rgba(0, 0, 0, 0.8)";
    (label as any).borderRadius = 4;
    (label as any).fontFace = "monospace";
    (label as any).fontSize = 20;
    (label as any).fontWeight = "bold";
    (label as any).material.depthTest = false;
    (label as any).material.depthWrite = false;
    (label as any).renderOrder = 999;
    return label;
  }

  private handleDirectionAnswer(canBeAdjacent: boolean): void {
    const pair = this.getCurrentPair();
    if (!pair) return;

    const direction = this.DIRECTIONS[this.currentDirection];
    const isSelfPair = pair.tileA === pair.tileB;

    if (isSelfPair) {
      const oppositeDir = OPPOSITE_DIRECTIONS[direction];
      this.setAdjacency(pair.tileA, pair.tileB, {
        [direction]: canBeAdjacent,
        [oppositeDir]: canBeAdjacent,
      });
    } else {
      this.setAdjacency(pair.tileA, pair.tileB, {
        [direction]: canBeAdjacent,
      });
    }

    this.updateReviewList();
    this.updatePairNavigationHighlight();

    const progress = {
      current: this.currentPairIndex + 1,
      total: this.allPairs.length,
      reviewed: this.reviewedPairs.size,
    };
    const allPairsCompleted = progress.reviewed === progress.total;

    if (this.currentDirection < 5) {
      if (isSelfPair) {
        const oppositeMap: { [key: number]: number } = {
          0: 1,
          1: 0,
          2: 3,
          3: 2,
          4: 5,
          5: 4,
        };
        const oppositeDirection = oppositeMap[this.currentDirection];
        this.currentDirection++;
        if (
          this.currentDirection === oppositeDirection &&
          this.currentDirection < 5
        ) {
          this.currentDirection++;
        }
        if (this.currentDirection <= 5) {
          if (allPairsCompleted) {
            this.checkCompletionAndCelebrate();
          } else {
            this.displayCurrentPair();
          }
        } else {
          this.currentDirection = 0;
          if (this.nextPair()) {
            this.displayCurrentPair();
          } else {
            this.checkCompletionAndCelebrate();
          }
        }
      } else {
        this.currentDirection++;
        if (allPairsCompleted) {
          this.checkCompletionAndCelebrate();
        } else {
          this.displayCurrentPair();
        }
      }
    } else {
      this.currentDirection = 0;
      if (this.nextPair()) {
        this.displayCurrentPair();
      } else {
        this.checkCompletionAndCelebrate();
      }
    }
  }

  private handleAllDirections(canBeAdjacent: boolean): void {
    const pair = this.getCurrentPair();
    if (!pair) return;

    this.setAdjacency(pair.tileA, pair.tileB, {
      up: canBeAdjacent,
      down: canBeAdjacent,
      north: canBeAdjacent,
      south: canBeAdjacent,
      east: canBeAdjacent,
      west: canBeAdjacent,
    });

    this.updateReviewList();
    this.updatePairNavigationHighlight();

    this.currentDirection = 0;
    if (this.nextPair()) {
      this.displayCurrentPair();
    } else {
      this.checkCompletionAndCelebrate();
    }
  }

  private setAdjacency(
    tileA: string,
    tileB: string,
    directions: { [key: string]: boolean }
  ): void {
    const tileAData = this.tiles.get(tileA);
    const tileBData = this.tiles.get(tileB);
    if (!tileAData || !tileBData) return;

    for (const [direction, enabled] of Object.entries(directions)) {
      const dir = direction as keyof AdjacencyData;
      const oppositeDir = OPPOSITE_DIRECTIONS[dir] as keyof AdjacencyData;

      if (enabled) {
        tileAData.adjacency[dir].add(tileB);
        tileBData.adjacency[oppositeDir].add(tileA);
      } else {
        tileAData.adjacency[dir].delete(tileB);
        tileBData.adjacency[oppositeDir].delete(tileA);
      }
    }

    this.reviewedPairs.add(this.getPairKey(tileA, tileB));
  }

  private nextPair(): boolean {
    if (this.currentPairIndex < this.allPairs.length - 1) {
      this.currentPairIndex++;
      return true;
    }
    return false;
  }

  private handlePrevious(): void {
    if (this.currentDirection > 0) {
      this.currentDirection--;
      this.displayCurrentPair();
    } else {
      if (this.currentPairIndex > 0) {
        this.currentPairIndex--;
        this.currentDirection = 5;
        this.displayCurrentPair();
      }
    }
  }

  private handleNext(): void {
    if (this.currentDirection < 5) {
      this.currentDirection++;
      this.displayCurrentPair();
    } else {
      if (this.nextPair()) {
        this.currentDirection = 0;
        this.displayCurrentPair();
      }
    }
  }

  private handleSkipPair(): void {
    this.currentDirection = 0;
    if (this.nextPair()) {
      this.displayCurrentPair();
    }
  }

  private updateNavigationButtons(): void {
    const progress = {
      current: this.currentPairIndex + 1,
      total: this.allPairs.length,
    };
    this.prevBtn.disabled =
      progress.current <= 1 && this.currentDirection === 0;
    this.nextBtn.disabled =
      progress.current >= progress.total && this.currentDirection === 5;
  }

  private updatePairNavigationHighlight(): void {
    const buttons = this.pairNavContainer.querySelectorAll(".pair-nav-btn");
    buttons.forEach((btn, index) => {
      const element = btn as HTMLElement;
      element.classList.remove("current", "complete");

      if (index === this.currentPairIndex) {
        element.classList.add("current");
      }

      if (this.isPairReviewed(index)) {
        element.classList.add("complete");
      }
    });
  }

  private toggleWeightsPanel(): void {
    const isVisible = this.weightsPanel.style.display !== "none";
    if (isVisible) {
      this.weightsPanel.style.display = "none";
      this.manageWeightsBtn.textContent = "Manage Tile Weights";
    } else {
      this.weightsPanel.style.display = "block";
      this.manageWeightsBtn.textContent = "Hide Tile Weights";
      this.populateWeightsPanel();
    }
  }

  private populateWeightsPanel(): void {
    this.weightsPanel.innerHTML = "";
    this.tiles.forEach((tile) => {
      const weightItem = document.createElement("div");
      weightItem.className = "weight-item";

      const label = document.createElement("label");
      label.textContent = tile.id;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "0.1";
      input.value = tile.weight.toString();
      input.addEventListener("change", () => {
        tile.weight = parseFloat(input.value) || 1;
        this.updateReviewList();
      });

      weightItem.appendChild(label);
      weightItem.appendChild(input);
      this.weightsPanel.appendChild(weightItem);
    });
  }

  private updateReviewList(): void {
    this.reviewList.innerHTML = "";
    this.tiles.forEach((tile) => {
      const item = document.createElement("div");
      item.className = "review-item";

      const adjacencies: string[] = [];
      (Object.keys(tile.adjacency) as (keyof AdjacencyData)[]).forEach(
        (dir) => {
          if (tile.adjacency[dir].size > 0) {
            adjacencies.push(
              `${dir}: [${Array.from(tile.adjacency[dir]).join(", ")}]`
            );
          }
        }
      );

      item.innerHTML = `
        <strong>${tile.id}</strong> (weight: ${tile.weight})<br/>
        ${
          adjacencies.length > 0
            ? adjacencies.join("<br/>")
            : "<em>No adjacencies</em>"
        }
      `;

      this.reviewList.appendChild(item);
    });
  }

  private checkCompletionAndCelebrate(): void {
    const progress = {
      current: this.currentPairIndex + 1,
      total: this.allPairs.length,
      reviewed: this.reviewedPairs.size,
    };

    if (progress.reviewed === progress.total) {
      this.jsConfetti.addConfetti();
      console.log("🎉 All adjacency pairings completed!");
    }
  }

  private handleExportJSON(): void {
    const json = this.exportToJSON();
    if (this.config.onExportJSON) {
      this.config.onExportJSON(json);
    } else {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "adjacency-config.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  private async handleExportGLB(): Promise<void> {
    try {
      this.loadingOverlay.classList.add("active");

      // Export each tile as individual GLB file
      if (this.directoryHandle) {
        // Save to directory (overwrite originals)
        await this.exportToDirectory();
      } else {
        // Fallback: download individual files
        await this.exportAsDownloads();
      }

      this.loadingOverlay.classList.remove("active");
      alert(`✅ Exported ${this.tiles.size} GLB files successfully!`);
    } catch (error) {
      console.error("Error exporting GLB:", error);
      alert("Error exporting GLB. Check console for details.");
      this.loadingOverlay.classList.remove("active");
    }
  }

  private async exportToDirectory(): Promise<void> {
    const { GLTFExporter } = await import(
      "three/examples/jsm/exporters/GLTFExporter.js"
    );

    for (const tile of this.tiles.values()) {
      if (!tile.object) continue;

      // Clone the object to avoid modifying the original
      const clone = tile.object.clone();

      // Add adjacency data to userData
      clone.userData = {
        tileId: tile.id,
        weight: tile.weight,
        adjacency: {
          up: Array.from(tile.adjacency.up),
          down: Array.from(tile.adjacency.down),
          north: Array.from(tile.adjacency.north),
          south: Array.from(tile.adjacency.south),
          east: Array.from(tile.adjacency.east),
          west: Array.from(tile.adjacency.west),
        },
      };

      // Export to GLB
      const exporter = new GLTFExporter();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          clone,
          (result) => resolve(result as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        );
      });

      // Save to directory (overwrite original file)
      const fileHandle = this.fileHandles.get(tile.id);
      if (fileHandle) {
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(arrayBuffer);
        await writable.close();
        console.log(`✓ Saved: ${tile.id}.glb`);
      } else {
        console.warn(`No file handle for ${tile.id}, skipping`);
      }
    }
  }

  private async exportAsDownloads(): Promise<void> {
    const { GLTFExporter } = await import(
      "three/examples/jsm/exporters/GLTFExporter.js"
    );

    for (const tile of this.tiles.values()) {
      if (!tile.object) continue;

      // Clone the object
      const clone = tile.object.clone();

      // Add adjacency data to userData
      clone.userData = {
        tileId: tile.id,
        weight: tile.weight,
        adjacency: {
          up: Array.from(tile.adjacency.up),
          down: Array.from(tile.adjacency.down),
          north: Array.from(tile.adjacency.north),
          south: Array.from(tile.adjacency.south),
          east: Array.from(tile.adjacency.east),
          west: Array.from(tile.adjacency.west),
        },
      };

      // Export to GLB
      const exporter = new GLTFExporter();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          clone,
          (result) => resolve(result as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        );
      });

      // Download file
      const blob = new Blob([arrayBuffer], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tile.id}.glb`;
      a.click();
      URL.revokeObjectURL(url);

      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private exportToJSON(): string {
    const configs: ModelTile3DConfig[] = [];

    for (const tile of this.tiles.values()) {
      const config: ModelTile3DConfig = {
        id: tile.id,
        weight: tile.weight,
        model:
          typeof tile.model === "string" ? tile.model : tile.model.toString(),
        adjacency: {
          up:
            tile.adjacency.up.size > 0
              ? Array.from(tile.adjacency.up)
              : undefined,
          down:
            tile.adjacency.down.size > 0
              ? Array.from(tile.adjacency.down)
              : undefined,
          north:
            tile.adjacency.north.size > 0
              ? Array.from(tile.adjacency.north)
              : undefined,
          south:
            tile.adjacency.south.size > 0
              ? Array.from(tile.adjacency.south)
              : undefined,
          east:
            tile.adjacency.east.size > 0
              ? Array.from(tile.adjacency.east)
              : undefined,
          west:
            tile.adjacency.west.size > 0
              ? Array.from(tile.adjacency.west)
              : undefined,
        },
      };

      if (Object.values(config.adjacency!).every((v) => v === undefined)) {
        config.adjacency = {};
      }

      configs.push(config);
    }

    return JSON.stringify(configs, null, 2);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Dispose of the builder and clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.controls.dispose();
    if (this.uiContainer) {
      this.uiContainer.remove();
    }
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
    }
    this.renderer.domElement.remove();
  }
}
