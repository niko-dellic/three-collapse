import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
// JSConfetti import removed: was only used in auto-generate which has been removed
import { DebugGrid } from "./DebugGrid";
import {
  pickDirectory,
  loadGLBFilesFromDirectory,
  parseGLBFiles,
  exportSceneToGLB,
  saveGLBToFileHandle,
  downloadGLB,
  downloadJSON,
} from "./GLBFileUtils";
import "./ConnectorBuilderUI.css";

// Connector data structures based on blog post
export interface ConnectorData {
  groupId: string;
  // For horizontal faces (north, south, east, west)
  symmetry?: "flipped" | "not-flipped" | "symmetric";
  // For vertical faces (up, down)
  rotation?: 0 | 1 | 2 | 3 | "invariant";
}

export interface TileConnectors {
  up: ConnectorData;
  down: ConnectorData;
  north: ConnectorData;
  south: ConnectorData;
  east: ConnectorData;
  west: ConnectorData;
}

export interface DirectionalExclusion {
  targetTileId: string;
  direction: "up" | "down" | "north" | "south" | "east" | "west";
}

export interface AdjacencyData {
  up: Set<string>;
  down: Set<string>;
  north: Set<string>;
  south: Set<string>;
  east: Set<string>;
  west: Set<string>;
}

export interface ConnectorTile {
  id: string;
  model: string | (() => THREE.Object3D);
  weight: number;
  connectors: TileConnectors;
  exclusions: DirectionalExclusion[];
  voxelCell: THREE.Group; // Container for the voxel cell
  mesh: THREE.Object3D; // The actual geometry (child of voxelCell)
  object: THREE.Object3D; // Alias for voxelCell for compatibility
  sourceFile: string;
  gridPosition: THREE.Vector2;
  visible: boolean;
  manuallyPositioned: boolean; // Track if user moved this tile
  adjacency: AdjacencyData; // Computed from connectors
}

const OPPOSITE_DIRECTIONS: { [key: string]: string } = {
  up: "down",
  down: "up",
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

export interface ConnectorBuilderConfig {
  container?: HTMLElement;
  gridSpacing?: number;
}

/**
 * Connector-Based Adjacency Builder
 *
 * Automates adjacency detection using face connectors following the WFC blog approach.
 */
export class ConnectorBuilderUI {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private orbitControls: OrbitControls;
  private transformControls: TransformControls;
  // jsConfetti removed: was only used in auto-generate which has been removed
  private debugGrid: DebugGrid;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private tiles: Map<string, ConnectorTile> = new Map();
  private selectedTiles: Set<string> = new Set();
  private gridSpacing: number;
  private voxelSize: number = 2; // Size of each voxel cell
  private gridRows: number = 0; // Number of rows in grid

  // File handling
  private directoryHandle: any = null;
  private fileHandles: Map<string, any> = new Map();

  // UI Elements
  private uiContainer!: HTMLDivElement;
  private loadFilesBtn!: HTMLButtonElement;
  private fileUpload!: HTMLInputElement;
  private builderSection!: HTMLDivElement;
  private selectionInfo!: HTMLDivElement;
  private clearSelectionBtn!: HTMLButtonElement;
  private weightInput!: HTMLInputElement;
  private applyWeightBtn!: HTMLButtonElement;
  private faceAssignmentSection!: HTMLDivElement;
  private faceDropdowns!: Map<keyof TileConnectors, HTMLSelectElement>;

  // Connector Groups UI
  private groupsList!: HTMLDivElement;
  private createGroupBtn!: HTMLButtonElement;
  private faceSelector!: HTMLSelectElement;
  private reformGridByGroupsBtn!: HTMLButtonElement;

  // Symmetry & Rotation UI
  private applyRotationBtn!: HTMLButtonElement;
  private applySymmetryBtn!: HTMLButtonElement;
  // TODO: Will add rotation/symmetry sections back in next refactor
  // private rotationSection!: HTMLDivElement;
  // private symmetrySection!: HTMLDivElement;

  private exclusionModeCheckbox!: HTMLInputElement;
  private exclusionInfo!: HTMLDivElement;
  private exclusionsList!: HTMLDivElement;
  private exclusionNoSelection!: HTMLDivElement;
  private exclusionActiveInfo!: HTMLDivElement;
  private exclusionSelectedCount!: HTMLSpanElement;
  private exclusionCurrentFace!: HTMLSpanElement;
  private showVoxelDebugToggle!: HTMLInputElement;
  private voxelSizeInput!: HTMLInputElement;
  private voxelSizeValue!: HTMLSpanElement;
  private gridRowsInput!: HTMLInputElement;
  private autoLayoutBtn!: HTMLButtonElement;
  // Auto-generate removed: adjacencies are computed dynamically during WFC
  private exportJsonBtn!: HTMLButtonElement;
  private exportGlbBtn!: HTMLButtonElement;
  private loadingOverlay!: HTMLDivElement;
  private selectionBox!: HTMLDivElement;
  private viewOptionsSection!: HTMLDivElement;
  private resizeHandle!: HTMLDivElement;

  // Resize state
  private isResizing: boolean = false;
  private resizeStartX: number = 0;
  private resizeStartWidth: number = 0;

  // Empty groups tracking (global - groups with no tiles assigned)
  private emptyGroups: Set<string> = new Set();

  // Group colors (global - each group has one color)
  private groupColors: Map<string, THREE.Color> = new Map();

  // Group visibility (global)
  private groupVisibility: Map<string, boolean> = new Map();

  // Shadcn-inspired color palette
  private colorPalette: number[] = [
    0xef4444, // red-500
    0xf97316, // orange-500
    0xf59e0b, // amber-500
    0xeab308, // yellow-500
    0x84cc16, // lime-500
    0x22c55e, // green-500
    0x10b981, // emerald-500
    0x14b8a6, // teal-500
    0x06b6d4, // cyan-500
    0x0ea5e9, // sky-500
    0x3b82f6, // blue-500
    0x6366f1, // indigo-500
    0x8b5cf6, // violet-500
    0xa855f7, // purple-500
    0xd946ef, // fuchsia-500
    0xec4899, // pink-500
    0xf43f5e, // rose-500
  ];

  // Selection box state
  private isSelecting = false;
  private selectionStart: THREE.Vector2 = new THREE.Vector2();
  private selectionEnd: THREE.Vector2 = new THREE.Vector2();

  // Click detection
  private mouseDownPos: THREE.Vector2 = new THREE.Vector2();

  // Align mode state
  private alignMode = false;
  private alignPlane: THREE.Plane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
  ); // XZ plane at y=0

  // Exclusion mode state
  private exclusionMode = false;

  // Transform mode (enabled by default)
  private transformMode = true;
  private transformHelper: THREE.Group; // Helper group for multi-object transforms
  private transformStartPositions: Map<string, THREE.Vector3> = new Map(); // Store initial positions
  private transformHelperStartPos: THREE.Vector3 = new THREE.Vector3(); // Store helper's initial position

  // Next available group ID index
  private nextGroupId = 0;

  constructor(config: ConnectorBuilderConfig = {}) {
    // Initialize voxelSize and gridSpacing (they should match)
    this.voxelSize = config.gridSpacing || 2;
    this.gridSpacing = this.voxelSize;

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
    this.camera.position.set(10, 10, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = config.container || document.body;
    container.appendChild(this.renderer.domElement);

    // Orbit controls
    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;

    // Transform controls
    this.transformControls = new TransformControls(
      this.camera,
      this.renderer.domElement
    );
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.orbitControls.enabled = !event.value;
    });
    this.transformControls.addEventListener("change", () => {
      this.handleTransformChange();
    });
    this.transformControls.setMode("translate");
    this.transformControls.setSpace("world");
    // Don't add to scene directly - TransformControls manages its own rendering
    // Add the helper to scene instead
    this.scene.add(this.transformControls.getHelper());

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);

    // Initialize debug grid (for voxel boundaries visualization)
    this.debugGrid = new DebugGrid(this.scene, 2);

    // jsConfetti initialization removed
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Create transform helper group for multi-object transforms
    this.transformHelper = new THREE.Group();
    this.transformHelper.name = "transformHelper";
    this.scene.add(this.transformHelper);

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
    this.uiContainer.id = "connector-ui";
    document.body.appendChild(this.uiContainer);

    // Build UI structure
    this.uiContainer.innerHTML = `
      <h2>Connector Builder</h2>
      
      <div class="section">
        <h3>Load GLB Files</h3>
        <button id="load-files-btn">📁 Load GLB Files</button>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
          Uses folder picker when available (Chrome, Edge)<br>
          Falls back to file upload (Safari, Firefox)
        </div>
        
        <!-- Hidden file input for fallback -->
        <input type="file" id="file-upload" multiple accept=".glb" style="display: none" />
        <div class="file-upload-info" id="file-upload-info" style="font-size: 11px; color: #94a3b8; margin-top: 10px"></div>
        
      </div>

        <div class="section" id="view-options-section" style="display: none">
          <h3>View Options</h3>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 8px">
            <input type="checkbox" id="show-voxel-debug-toggle" />
            Show voxel boundaries
          </label>
          
          <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
            <label style="display: block; margin-bottom: 5px">
              Voxel Size: <span id="voxel-size-value">2</span>
            </label>
            <input type="range" id="voxel-size-input" min="0.5" max="10" step="0.5" value="2" style="width: 100%; flex: 1;" />
          </div>

          <div style="margin-bottom: 10px">
            <label style="display: block; margin-bottom: 5px">
              Grid Rows: <input type="number" id="grid-rows-input" min="0" max="50" value="0" style="width: 60px" />
            </label>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
              Set to 0 for automatic square grid
            </div>
          </div>
          <button id="auto-layout-btn">Apply Grid Layout</button>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
            Only affects tiles not manually moved
          </div>
        </div>
        

      <div id="builder-section" style="display: none">

       <div class="section">
          <h3>Connector Groups</h3>
          
          <div style="margin-bottom: 12px">
            <label style="display: block; margin-bottom: 5px; font-weight: 500">
              Groups (click name to edit):
            </label>
            <div id="groups-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #334155; border-radius: 4px; padding: 4px">
              <em style="padding: 8px; display: block; color: #94a3b8">No groups</em>
            </div>
          </div>

          <button id="create-group-btn" style="width: 100%">+ Create New Group</button>
          
          <div style="margin-top: 12px; margin-bottom: 8px">
            <label style="display: block; margin-bottom: 5px; font-weight: 500">
              Face for Operations:
            </label>
            <select id="face-selector" style="width: 100%; padding: 6px">
              <option value="up">Up (Vertical)</option>
              <option value="down">Down (Vertical)</option>
              <option value="north">North (Horizontal)</option>
              <option value="south">South (Horizontal)</option>
              <option value="east">East (Horizontal)</option>
              <option value="west">West (Horizontal)</option>
            </select>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
              Used for voxel colors and grid reform
            </div>
          </div>
          
          <button id="reform-grid-by-groups-btn" style="width: 100%">📐 Reform Grid by Groups</button>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
            Arranges tiles into separate grids per connector group
          </div>
        </div>


        <div class="section">
          <h3>Selection</h3>
          <div class="selection-info" id="selection-info">
            <strong>0</strong> tiles selected
          </div>
          
          <div style="margin-top: 12px; margin-bottom: 8px">
            <label style="display: block; margin-bottom: 5px; font-weight: 500">
              Weight:
            </label>
            <div style="display: flex; gap: 8px; align-items: center">
              <input 
                type="number" 
                id="weight-input" 
                min="0.1" 
                step="0.1" 
                value="1" 
                style="flex: 1; padding: 4px 8px; width: 100%"
                placeholder="1.0"
              />
              <button id="apply-weight-btn" style="padding: 4px 12px; white-space: nowrap">Apply</button>
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
              Set weight for selected tiles (affects spawn probability)
            </div>
          </div>

          <div id="face-assignment-section" style="margin-top: 12px; margin-bottom: 8px; display: none">
            <label style="display: block; margin-bottom: 8px; font-weight: 500">
              Assign Groups to Faces:
            </label>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center">
              <label style="font-size: 12px">Up:</label>
              <select id="face-up-dropdown" class="face-dropdown" data-face="up" style="padding: 4px; font-size: 12px"></select>
              
              <label style="font-size: 12px">Down:</label>
              <select id="face-down-dropdown" class="face-dropdown" data-face="down" style="padding: 4px; font-size: 12px"></select>
              
              <label style="font-size: 12px">North:</label>
              <select id="face-north-dropdown" class="face-dropdown" data-face="north" style="padding: 4px; font-size: 12px"></select>
              
              <label style="font-size: 12px">South:</label>
              <select id="face-south-dropdown" class="face-dropdown" data-face="south" style="padding: 4px; font-size: 12px"></select>
              
              <label style="font-size: 12px">East:</label>
              <select id="face-east-dropdown" class="face-dropdown" data-face="east" style="padding: 4px; font-size: 12px"></select>
              
              <label style="font-size: 12px">West:</label>
              <select id="face-west-dropdown" class="face-dropdown" data-face="west" style="padding: 4px; font-size: 12px"></select>
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
              Select group for each face of selected tiles
            </div>
          </div>
          
          <button id="clear-selection-btn">Clear Selection</button>
        </div>

       
        <div class="section">
          <h3>Symmetry & Rotation</h3>
          
          <div id="rotation-section" style="margin-bottom: 12px">
            <label style="display: block; margin-bottom: 8px; font-weight: 500">Rotation (Vertical Faces):</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px">
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="rotation" value="0" />
                0
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="rotation" value="1" />
                1
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="rotation" value="2" />
                2
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="rotation" value="3" />
                3
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="rotation" value="invariant" checked />
                Invariant
              </label>
            </div>
            <button id="apply-rotation-btn" style="margin-top: 8px; width: 100%" disabled>Apply Rotation</button>
          </div>

          <div id="symmetry-section" style="display: none">
            <label style="display: block; margin-bottom: 8px; font-weight: 500">Symmetry (Horizontal Faces):</label>
            <div style="display: flex; flex-direction: column; gap: 8px">
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="symmetry" value="flipped" />
                Flipped
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="symmetry" value="not-flipped" />
                Not Flipped
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer">
                <input type="radio" name="symmetry" value="symmetric" checked />
                Symmetric
              </label>
            </div>
            <button id="apply-symmetry-btn" style="margin-top: 8px; width: 100%" disabled>Apply Symmetry</button>
          </div>
        </div>

        <div class="section">
          <h3>Exclusions</h3>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer" title="Select tiles first to enable exclusion mode">
            <input type="checkbox" id="exclusion-mode-checkbox" />
            Enable Exclusion Mode
          </label>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 5px">
            Select tiles first to enable
          </div>
          <div class="exclusion-info" id="exclusion-info">
            <div id="exclusion-no-selection" style="display: none;">
              <em style="color: #fca5a5">⚠ Select tiles first</em>
            </div>
            <div id="exclusion-active-info" style="display: none;">
              <strong>Selected:</strong> <span id="exclusion-selected-count"></span> tile(s)<br/>
              <strong>Face:</strong> <span id="exclusion-current-face"></span><br/>
              <em style="font-size: 11px; color: #94a3b8">Click tiles to add as exclusions</em>
            </div>
          </div>
          <div class="exclusions-list" id="exclusions-list"></div>
        </div>



        <div class="section">
          <h3>Actions</h3>
          <!-- Auto-Generate Adjacencies removed: adjacencies are computed dynamically during WFC -->
          <button id="export-json-btn">Export JSON</button>
          <button id="export-glb-btn" class="success-btn">Save GLB Files</button>
        </div>

        <div class="section">
          <h3>Keyboard Shortcuts</h3>
          <div class="shortcuts-help">
            <kbd>G</kbd> Toggle Move Mode<br/>
            <kbd>A</kbd> Align to Cursor<br/>
            <kbd>ESC</kbd> Deselect All / Cancel<br/>
            <kbd>Shift+Click</kbd> Multi-Select<br/>
            <kbd>Ctrl/Cmd+Click</kbd> Toggle Select<br/>
            <kbd>Shift+Drag</kbd> Box Select
          </div>
        </div>
      </div>
    `;

    // Create loading overlay
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.id = "connector-loading-overlay";
    this.loadingOverlay.innerHTML = "<div>Loading models...</div>";
    document.body.appendChild(this.loadingOverlay);

    // Create selection box overlay
    this.selectionBox = document.createElement("div");
    this.selectionBox.id = "selection-box";
    document.body.appendChild(this.selectionBox);

    // Create resize handle
    this.resizeHandle = document.createElement("div");
    this.resizeHandle.id = "connector-ui-resize-handle";
    this.uiContainer.appendChild(this.resizeHandle);

    // Load saved width from localStorage
    const savedWidth = localStorage.getItem("connectorBuilderWidth");
    if (savedWidth) {
      this.uiContainer.style.width = savedWidth + "px";
    }

    // Setup resize functionality
    this.setupResizeHandle();

    // Get references to UI elements
    this.loadFilesBtn = document.getElementById(
      "load-files-btn"
    ) as HTMLButtonElement;
    this.fileUpload = document.getElementById(
      "file-upload"
    ) as HTMLInputElement;
    this.builderSection = document.getElementById(
      "builder-section"
    ) as HTMLDivElement;
    this.selectionInfo = document.getElementById(
      "selection-info"
    ) as HTMLDivElement;
    this.clearSelectionBtn = document.getElementById(
      "clear-selection-btn"
    ) as HTMLButtonElement;
    this.weightInput = document.getElementById(
      "weight-input"
    ) as HTMLInputElement;
    this.applyWeightBtn = document.getElementById(
      "apply-weight-btn"
    ) as HTMLButtonElement;

    // Face assignment dropdowns
    this.faceAssignmentSection = document.getElementById(
      "face-assignment-section"
    ) as HTMLDivElement;
    this.faceDropdowns = new Map([
      ["up", document.getElementById("face-up-dropdown") as HTMLSelectElement],
      [
        "down",
        document.getElementById("face-down-dropdown") as HTMLSelectElement,
      ],
      [
        "north",
        document.getElementById("face-north-dropdown") as HTMLSelectElement,
      ],
      [
        "south",
        document.getElementById("face-south-dropdown") as HTMLSelectElement,
      ],
      [
        "east",
        document.getElementById("face-east-dropdown") as HTMLSelectElement,
      ],
      [
        "west",
        document.getElementById("face-west-dropdown") as HTMLSelectElement,
      ],
    ]);

    // Connector Groups UI
    this.groupsList = document.getElementById("groups-list") as HTMLDivElement;
    this.createGroupBtn = document.getElementById(
      "create-group-btn"
    ) as HTMLButtonElement;
    this.faceSelector = document.getElementById(
      "face-selector"
    ) as HTMLSelectElement;
    this.reformGridByGroupsBtn = document.getElementById(
      "reform-grid-by-groups-btn"
    ) as HTMLButtonElement;

    // Symmetry & Rotation UI
    // TODO: Will restore these in next refactor
    // this.rotationSection = document.getElementById(
    //   "rotation-section"
    // ) as HTMLDivElement;
    // this.symmetrySection = document.getElementById(
    //   "symmetry-section"
    // ) as HTMLDivElement;
    this.applyRotationBtn = document.getElementById(
      "apply-rotation-btn"
    ) as HTMLButtonElement;
    this.applySymmetryBtn = document.getElementById(
      "apply-symmetry-btn"
    ) as HTMLButtonElement;
    this.exclusionModeCheckbox = document.getElementById(
      "exclusion-mode-checkbox"
    ) as HTMLInputElement;
    this.exclusionInfo = document.getElementById(
      "exclusion-info"
    ) as HTMLDivElement;
    this.exclusionsList = document.getElementById(
      "exclusions-list"
    ) as HTMLDivElement;
    this.exclusionNoSelection = document.getElementById(
      "exclusion-no-selection"
    ) as HTMLDivElement;
    this.exclusionActiveInfo = document.getElementById(
      "exclusion-active-info"
    ) as HTMLDivElement;
    this.exclusionSelectedCount = document.getElementById(
      "exclusion-selected-count"
    ) as HTMLSpanElement;
    this.exclusionCurrentFace = document.getElementById(
      "exclusion-current-face"
    ) as HTMLSpanElement;
    this.showVoxelDebugToggle = document.getElementById(
      "show-voxel-debug-toggle"
    ) as HTMLInputElement;
    this.voxelSizeInput = document.getElementById(
      "voxel-size-input"
    ) as HTMLInputElement;
    this.voxelSizeValue = document.getElementById(
      "voxel-size-value"
    ) as HTMLSpanElement;
    this.gridRowsInput = document.getElementById(
      "grid-rows-input"
    ) as HTMLInputElement;
    this.autoLayoutBtn = document.getElementById(
      "auto-layout-btn"
    ) as HTMLButtonElement;
    // Auto-generate button removed
    this.exportJsonBtn = document.getElementById(
      "export-json-btn"
    ) as HTMLButtonElement;
    this.exportGlbBtn = document.getElementById(
      "export-glb-btn"
    ) as HTMLButtonElement;
    this.viewOptionsSection = document.getElementById(
      "view-options-section"
    ) as HTMLDivElement;

    // Enable voxel debug by default (but section is hidden until files are loaded)
    this.showVoxelDebugToggle.checked = true;
    this.debugGrid.setVisible(true);

    // Disable exclusion mode checkbox initially (no tiles selected yet)
    this.exclusionModeCheckbox.disabled = true;
  }

  private setupResizeHandle(): void {
    const handleMouseDown = (e: MouseEvent) => {
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartWidth = this.uiContainer.offsetWidth;
      this.resizeHandle.classList.add("resizing");

      // Prevent text selection during resize
      e.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;

      // Calculate new width (drag left to increase, right to decrease)
      const deltaX = this.resizeStartX - e.clientX;
      const newWidth = this.resizeStartWidth + deltaX;

      // Constrain to min/max
      const minWidth = 300;
      const maxWidth = 800;
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      this.uiContainer.style.width = constrainedWidth + "px";
    };

    const handleMouseUp = () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.resizeHandle.classList.remove("resizing");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        // Save width to localStorage
        localStorage.setItem(
          "connectorBuilderWidth",
          this.uiContainer.offsetWidth.toString()
        );
      }
    };

    // Add event listeners
    this.resizeHandle.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  private setupEventListeners(): void {
    // Load files button - try directory picker first, fallback to file upload
    this.loadFilesBtn.addEventListener("click", () => this.handleLoadFiles());

    // File upload change - update info text and auto-load
    this.fileUpload.addEventListener("change", async () => {
      const fileInfo = document.getElementById("file-upload-info");
      if (fileInfo) {
        const count = this.fileUpload.files?.length || 0;
        if (count === 0) {
          fileInfo.textContent = "";
        } else if (count === 1) {
          fileInfo.textContent = `Selected: ${this.fileUpload.files![0].name}`;
        } else {
          fileInfo.textContent = `Selected: ${count} files`;
        }
      }

      // Auto-load after file selection
      if (this.fileUpload.files && this.fileUpload.files.length > 0) {
        await this.handleLoadFromFiles();
      }
    });

    // Selection actions
    this.clearSelectionBtn.addEventListener("click", () =>
      this.clearSelection()
    );
    this.applyWeightBtn.addEventListener("click", () => this.applyWeight());

    // Face assignment dropdown handlers
    for (const [face, dropdown] of this.faceDropdowns) {
      dropdown.addEventListener("change", () => {
        const groupId = dropdown.value;
        if (groupId && this.selectedTiles.size > 0) {
          this.assignGroupToFace(groupId, face);
        }
      });
    }

    // Connector Groups UI
    this.createGroupBtn.addEventListener("click", () => this.createGroup());
    this.faceSelector.addEventListener("change", () => {
      // Update voxel colors when face changes
      if (this.showVoxelDebugToggle.checked) {
        this.updateVoxelDebug();
      }
    });
    this.reformGridByGroupsBtn.addEventListener("click", () =>
      this.reformGridByGroups()
    );

    // Group list event handling (assign, select all, rename, delete)
    this.groupsList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains("color-thumbnail")) {
        const groupId = target.dataset.groupId;
        if (groupId) {
          this.changeGroupColor(groupId);
        }
      } else if (target.classList.contains("delete-btn")) {
        const groupId = target.dataset.groupId;
        const button = target as HTMLButtonElement;
        // Only allow deleting empty groups
        if (groupId && !button.disabled) {
          this.deleteGroup(groupId);
        }
      } else if (target.classList.contains("group-item")) {
        // Click on group item itself - select all tiles in this group
        const groupId = target.dataset.groupId;
        if (groupId) this.selectAllInGroup(groupId);
      }
    });

    // Handle inline editing of group names
    this.groupsList.addEventListener(
      "blur",
      (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("group-name-edit")) {
          const oldGroupId = target.dataset.groupId;
          const newGroupId = target.textContent?.trim();
          if (oldGroupId && newGroupId && newGroupId !== oldGroupId) {
            this.renameGroup(oldGroupId, newGroupId);
          }
        }
      },
      true
    );

    // Prevent newlines in contenteditable
    this.groupsList.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("group-name-edit") && e.key === "Enter") {
        e.preventDefault();
        target.blur();
      }
    });

    // Visibility toggle handler (global visibility)
    this.groupsList.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains("visibility-toggle")) {
        const groupId = target.dataset.groupId;
        if (groupId) {
          this.setGroupVisibility(groupId, target.checked);
          console.log(
            `👁️ Group "${groupId}" visibility: ${target.checked ? "ON" : "OFF"}`
          );
        }
      }
    });

    // Symmetry & Rotation UI
    this.applyRotationBtn.addEventListener("click", () => this.applyRotation());
    this.applySymmetryBtn.addEventListener("click", () => this.applySymmetry());

    // Exclusion mode
    this.exclusionModeCheckbox.addEventListener("change", () => {
      this.exclusionMode = this.exclusionModeCheckbox.checked;
      if (this.exclusionMode) {
        this.exclusionInfo.classList.add("active");
        // Update UI to show current state
        this.updateExclusionUI();
        // Update exclusions list to show selected tiles' exclusions
        this.updateExclusionsList();
        console.log("✓ Exclusion mode enabled");
      } else {
        this.exclusionInfo.classList.remove("active");
        // Hide both UI sections
        this.exclusionNoSelection.style.display = "none";
        this.exclusionActiveInfo.style.display = "none";
        console.log("✓ Exclusion mode disabled");
      }
    });

    // Voxel debug toggle
    this.showVoxelDebugToggle.addEventListener("change", () => {
      this.debugGrid.setVisible(this.showVoxelDebugToggle.checked);
      if (this.showVoxelDebugToggle.checked) {
        this.updateVoxelDebug();
      }
    });

    // Voxel size slider
    this.voxelSizeInput.addEventListener("input", () => {
      this.voxelSize = parseFloat(this.voxelSizeInput.value);
      this.voxelSizeValue.textContent = this.voxelSize.toString();
      this.gridSpacing = this.voxelSize; // Grid spacing matches voxel size

      // Reposition all tiles based on their grid positions to prevent overlap
      for (const tile of this.tiles.values()) {
        tile.voxelCell.position.set(
          tile.gridPosition.x * this.gridSpacing,
          0,
          tile.gridPosition.y * this.gridSpacing
        );
      }

      // Update voxel debug if enabled
      if (this.showVoxelDebugToggle.checked) {
        this.updateVoxelDebug();
      }
    });

    // Grid layout inputs
    this.gridRowsInput.addEventListener("change", () => {
      this.gridRows = parseInt(this.gridRowsInput.value) || 0;
    });

    // Auto layout button
    this.autoLayoutBtn.addEventListener("click", () => this.applyGridLayout());

    // Actions
    // Auto-generate listener removed
    this.exportJsonBtn.addEventListener("click", () => this.handleExportJSON());
    this.exportGlbBtn.addEventListener("click", () => this.handleExportGLB());

    // Mouse events for selection box and tile clicking
    this.renderer.domElement.addEventListener("mousedown", (e) =>
      this.onMouseDown(e)
    );
    this.renderer.domElement.addEventListener("mousemove", (e) =>
      this.onMouseMove(e)
    );
    this.renderer.domElement.addEventListener("mouseup", (e) =>
      this.onMouseUp(e)
    );

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private async handleLoadFiles(): Promise<void> {
    // Try directory picker first if supported
    if ("showDirectoryPicker" in window) {
      try {
        this.directoryHandle = await pickDirectory();

        // Update info text
        const fileInfo = document.getElementById("file-upload-info");
        if (fileInfo && this.directoryHandle) {
          fileInfo.textContent = `Selected folder: ${this.directoryHandle.name}`;
        }

        this.handleStart();
      } catch (error) {
        // User cancelled or error occurred - don't fallback automatically
        if ((error as Error).name !== "AbortError") {
          console.error("Error picking directory:", error);
          alert("Error accessing directory. Check console for details.");
        }
      }
    } else {
      // Fallback to file upload for browsers that don't support directory picker
      console.log(
        "Directory picker not supported, falling back to file upload"
      );
      this.fileUpload.click();
    }
  }

  private async handleLoadFromFiles(): Promise<void> {
    this.handleStart();
  }

  private async handleStart(): Promise<void> {
    try {
      this.loadingOverlay.classList.add("active");

      let files: File[] = [];

      if (this.directoryHandle) {
        const result = await loadGLBFilesFromDirectory(this.directoryHandle);
        files = result.files;
        this.fileHandles = result.fileHandles;
      } else if (this.fileUpload.files && this.fileUpload.files.length > 0) {
        files = Array.from(this.fileUpload.files);
      } else {
        alert("Please load GLB files first");
        this.loadingOverlay.classList.remove("active");
        return;
      }

      await this.loadGLBFiles(files);

      this.builderSection.style.display = "block";
      this.viewOptionsSection.style.display = "block";
      this.loadFilesBtn.disabled = true;

      this.loadingOverlay.classList.remove("active");
    } catch (error) {
      console.error("Error initializing:", error);
      alert("Error loading models. Check console for details.");
      this.loadingOverlay.classList.remove("active");
    }
  }

  private async loadGLBFiles(files: File[]): Promise<void> {
    this.tiles.clear();

    const loadedFiles = await parseGLBFiles(files);

    let tileIndex = 0;
    for (const { file, filename, meshes } of loadedFiles) {
      console.log(`Processing ${filename}.glb with ${meshes.length} mesh(es)`);

      for (const mesh of meshes) {
        // Generate tile ID: check userData.tileId first, then use filename_meshname
        const tileId = mesh.userData.tileId || `${filename}_${mesh.name}`;

        // Load existing connector data if present
        const userData = mesh.userData;
        const existingConnectors = userData.connectors;

        const connectors: TileConnectors = existingConnectors || {
          up: { groupId: "0", rotation: "invariant" as const },
          down: { groupId: "0", rotation: "invariant" as const },
          north: { groupId: "0", symmetry: "symmetric" as const },
          south: { groupId: "0", symmetry: "symmetric" as const },
          east: { groupId: "0", symmetry: "symmetric" as const },
          west: { groupId: "0", symmetry: "symmetric" as const },
        };

        // Load existing exclusions if present
        const existingExclusions = userData.exclusions || [];

        // Calculate grid position
        const cols = Math.ceil(Math.sqrt(this.tiles.size + 1));
        const row = Math.floor(tileIndex / cols);
        const col = tileIndex % cols;

        // Clone the mesh to create an independent object
        const clonedMesh = mesh.clone();

        // Clear parent transformations on the mesh (reset to identity)
        clonedMesh.position.set(0, 0, 0);
        clonedMesh.rotation.set(0, 0, 0);
        clonedMesh.scale.set(1, 1, 1);

        // Clone materials so each tile has independent materials
        clonedMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const childMesh = child as THREE.Mesh;
            if (childMesh.material) {
              // Clone the material (or array of materials)
              if (Array.isArray(childMesh.material)) {
                childMesh.material = childMesh.material.map((mat) =>
                  mat.clone()
                );
              } else {
                childMesh.material = childMesh.material.clone();
              }
            }
          }
        });

        // Create voxel cell (container for the mesh)
        const voxelCell = new THREE.Group();
        voxelCell.name = `voxel_${tileId}`;

        // Add mesh as child of voxel cell, centered at origin
        voxelCell.add(clonedMesh);

        const tile: ConnectorTile = {
          id: tileId,
          model: URL.createObjectURL(file),
          weight: userData.weight || 1,
          connectors,
          exclusions: existingExclusions,
          voxelCell: voxelCell,
          mesh: clonedMesh,
          object: voxelCell, // Alias for compatibility
          sourceFile: filename,
          gridPosition: new THREE.Vector2(col, row),
          visible: true,
          manuallyPositioned: false,
          adjacency: {
            up: new Set(),
            down: new Set(),
            north: new Set(),
            south: new Set(),
            east: new Set(),
            west: new Set(),
          },
        };

        // Position voxel cell in grid (not the mesh)
        voxelCell.position.set(
          col * this.gridSpacing,
          0,
          row * this.gridSpacing
        );

        this.scene.add(voxelCell);
        this.tiles.set(tileId, tile);
        tileIndex++;

        console.log(`  ✓ Loaded tile: ${tileId}`);
      }
    }

    console.log(`Loaded ${this.tiles.size} tiles in grid layout`);

    // Apply grid layout to arrange tiles in a square grid
    this.applyGridLayout();

    // Initialize groups UI
    this.updateGroupsList();
  }

  private applyGridLayout(): void {
    // Get all non-manually-positioned tiles
    const tilesToLayout: ConnectorTile[] = [];
    for (const tile of this.tiles.values()) {
      if (!tile.manuallyPositioned) {
        tilesToLayout.push(tile);
      }
    }

    if (tilesToLayout.length === 0) {
      console.log("No tiles to layout (all manually positioned)");
      return;
    }

    // Calculate grid dimensions
    let rows = this.gridRows;
    let cols: number;

    if (rows === 0) {
      // Auto square grid
      cols = Math.ceil(Math.sqrt(tilesToLayout.length));
      rows = Math.ceil(tilesToLayout.length / cols);
    } else {
      // Calculate cols from rows
      cols = Math.ceil(tilesToLayout.length / rows);
    }

    // Update stored grid dimensions
    this.gridRows = rows;
    this.gridRowsInput.value = rows.toString();

    // Position tiles in grid
    for (let i = 0; i < tilesToLayout.length; i++) {
      const tile = tilesToLayout[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Update grid position
      tile.gridPosition.set(col, row);

      // Position voxel cell
      tile.voxelCell.position.set(
        col * this.gridSpacing,
        0,
        row * this.gridSpacing
      );
    }

    console.log(
      `Repositioned ${tilesToLayout.length} tiles in ${cols}x${rows} grid`
    );

    // Update voxel debug if enabled
    if (this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private reformGridByGroups(): void {
    const currentFace = this.getSelectedFace();

    // Group tiles by their connector group ID for the current face
    const tilesByGroup = new Map<string, ConnectorTile[]>();
    for (const tile of this.tiles.values()) {
      const groupId = tile.connectors[currentFace].groupId;
      if (!tilesByGroup.has(groupId)) {
        tilesByGroup.set(groupId, []);
      }
      tilesByGroup.get(groupId)!.push(tile);
    }

    console.log(
      `Reforming grid: ${tilesByGroup.size} groups for face "${currentFace}"`
    );

    // Calculate layout for each group
    const groups = Array.from(tilesByGroup.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    let currentGroupOffsetZ = 0;
    const groupSpacing = 5; // Extra spacing between groups

    for (const [groupId, tiles] of groups) {
      // Calculate grid dimensions for this group
      const cols = Math.ceil(Math.sqrt(tiles.length));
      const rows = Math.ceil(tiles.length / cols);

      console.log(
        `  Group "${groupId}": ${tiles.length} tiles in ${cols}x${rows} grid`
      );

      // Position tiles in this group's grid
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const row = Math.floor(i / cols);
        const col = i % cols;

        // Update grid position
        tile.gridPosition.set(col, currentGroupOffsetZ + row);

        // Position voxel cell
        tile.voxelCell.position.set(
          col * this.gridSpacing,
          0,
          (currentGroupOffsetZ + row) * this.gridSpacing
        );

        // Mark as manually positioned so regular grid layout won't move them
        tile.manuallyPositioned = true;
      }

      // Move to next group's Z position (with spacing)
      currentGroupOffsetZ += rows + groupSpacing / this.gridSpacing;
    }

    console.log(
      `✓ Reformed grid: ${this.tiles.size} tiles organized into ${tilesByGroup.size} groups`
    );

    // Update voxel debug if enabled
    if (this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private handleTransformChange(): void {
    if (this.selectedTiles.size === 0) return;

    if (this.selectedTiles.size === 1) {
      // Single tile transform
      const tileId = Array.from(this.selectedTiles)[0];
      const tile = this.tiles.get(tileId);
      if (tile && tile.voxelCell) {
        const pos = tile.voxelCell.position;
        tile.gridPosition.set(
          Math.round(pos.x / this.gridSpacing),
          Math.round(pos.z / this.gridSpacing)
        );
        tile.manuallyPositioned = true;
      }
    } else {
      // Multi-tile transform: update all selected tiles based on helper group offset
      const helperDelta = this.transformHelper.position
        .clone()
        .sub(this.transformHelperStartPos);

      for (const tileId of this.selectedTiles) {
        const tile = this.tiles.get(tileId);
        if (!tile) continue;

        const startPos = this.transformStartPositions.get(tileId);
        if (!startPos) continue;

        // Apply the helper's delta to the original position
        const newPos = startPos.clone().add(helperDelta);
        tile.voxelCell.position.copy(newPos);

        // Update grid position
        tile.gridPosition.set(
          Math.round(newPos.x / this.gridSpacing),
          Math.round(newPos.z / this.gridSpacing)
        );
        tile.manuallyPositioned = true;
      }
    }

    // Update voxel debug if enabled
    if (this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private attachTransformControlsToSelection(): void {
    if (!this.transformMode || this.selectedTiles.size === 0) {
      this.transformControls.detach();
      return;
    }

    if (this.selectedTiles.size === 1) {
      // Single tile: attach directly to voxel cell
      const tileId = Array.from(this.selectedTiles)[0];
      const tile = this.tiles.get(tileId);
      if (tile) {
        this.transformControls.attach(tile.voxelCell);
      }
    } else {
      // Multi-tile: calculate bbox center and attach to helper
      const selectedTiles = Array.from(this.selectedTiles)
        .map((id) => this.tiles.get(id))
        .filter((tile) => tile !== undefined) as ConnectorTile[];

      if (selectedTiles.length === 0) return;

      // Calculate bounding box center
      const bbox = new THREE.Box3();
      for (const tile of selectedTiles) {
        bbox.expandByObject(tile.voxelCell);
      }

      const center = new THREE.Vector3();
      bbox.getCenter(center);

      // Position helper at bbox center
      this.transformHelper.position.copy(center);
      this.transformHelper.rotation.set(0, 0, 0);
      this.transformHelper.scale.set(1, 1, 1);

      // Store helper's start position
      this.transformHelperStartPos.copy(center);

      // Store start positions for all selected tiles
      this.transformStartPositions.clear();
      for (const tile of selectedTiles) {
        this.transformStartPositions.set(
          tile.id,
          tile.voxelCell.position.clone()
        );
      }

      // Attach transform controls to helper
      this.transformControls.attach(this.transformHelper);
    }
  }

  private setCameraView(
    position: THREE.Vector3,
    target: THREE.Vector3,
    duration: number = 500
  ): void {
    const startPosition = this.camera.position.clone();
    const startTarget = this.orbitControls.target.clone();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing (ease-in-out cubic)
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolate camera position and target
      this.camera.position.lerpVectors(startPosition, position, eased);
      this.orbitControls.target.lerpVectors(startTarget, target, eased);
      this.orbitControls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private onMouseDown(event: MouseEvent): void {
    // Handle align mode click (finalize position)
    if (this.alignMode) {
      this.finalizeAlignPosition();
      return;
    }

    // Record mouse position for click detection
    this.mouseDownPos.set(event.clientX, event.clientY);

    // Handle exclusion mode clicks
    if (this.exclusionMode) {
      this.handleExclusionClick(event);
      return;
    }

    // Don't start selection if clicking on transform controls
    if (this.transformControls.dragging) return;

    // Ignore right-click (used for orbit controls)
    if (event.button === 2) {
      return;
    }

    // Only handle Shift+Drag box selection on mousedown
    // Regular tile selection happens on mouseup to avoid selecting while orbiting
    if (event.shiftKey) {
      const intersectedTile = this.getTileAtMouse(event);
      if (!intersectedTile) {
        // Start selection box ONLY when Shift is held and clicking empty space
        this.isSelecting = true;
        this.selectionStart.set(event.clientX, event.clientY);
        this.selectionEnd.set(event.clientX, event.clientY);
        // Disable orbit controls during box selection
        this.orbitControls.enabled = false;
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    // Update align position if in align mode
    if (this.alignMode) {
      this.updateAlignPosition(event);
      return;
    }

    if (this.isSelecting) {
      this.selectionEnd.set(event.clientX, event.clientY);
      this.updateSelectionBox();
    }
  }

  private onMouseUp(event: MouseEvent): void {
    // Don't handle selection in exclusion mode (handled in onMouseDown via handleExclusionClick)
    if (this.exclusionMode) {
      return;
    }

    // Handle box selection end
    if (this.isSelecting) {
      this.isSelecting = false;
      this.selectionBox.classList.remove("active");
      this.performBoxSelection();
      // Re-enable orbit controls after selection
      this.orbitControls.enabled = true;
      return;
    }

    // Check if this was a click (mouse barely moved) vs a drag (orbit)
    const deltaX = Math.abs(event.clientX - this.mouseDownPos.x);
    const deltaY = Math.abs(event.clientY - this.mouseDownPos.y);
    const isClick = deltaX < 5 && deltaY < 5;

    // Only handle selection on click (not drag)
    if (!isClick) return;

    // Ignore right-click
    if (event.button === 2) return;

    // Get tile at mouse position
    const intersectedTile = this.getTileAtMouse(event);

    if (intersectedTile) {
      // Tile clicked
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        // Multi-select toggle (Shift or Ctrl/Cmd)
        if (this.selectedTiles.has(intersectedTile)) {
          this.selectedTiles.delete(intersectedTile);
        } else {
          this.selectedTiles.add(intersectedTile);
        }
      } else {
        // Single select
        if (!this.selectedTiles.has(intersectedTile)) {
          this.clearSelection();
          this.selectedTiles.add(intersectedTile);
        }
      }
      this.updateSelection();
    } else if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Clicked empty space without modifier keys - clear selection
      this.clearSelection();
    }
  }

  private updateSelectionBox(): void {
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

    this.selectionBox.style.left = `${minX}px`;
    this.selectionBox.style.top = `${minY}px`;
    this.selectionBox.style.width = `${maxX - minX}px`;
    this.selectionBox.style.height = `${maxY - minY}px`;
    this.selectionBox.classList.add("active");
  }

  private performBoxSelection(): void {
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

    // Create selection rectangle
    const selectionRect = {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
    };

    // Check each tile if its bounding box intersects with the selection box
    for (const [tileId, tile] of this.tiles.entries()) {
      if (!tile.visible) continue;

      if (this.isObjectInSelectionBox(tile.object, selectionRect)) {
        this.selectedTiles.add(tileId);
      }
    }

    this.updateSelection();
  }

  private isObjectInSelectionBox(
    object: THREE.Object3D,
    selectionRect: { left: number; top: number; right: number; bottom: number }
  ): boolean {
    // Compute the 3D bounding box of the object
    const box = new THREE.Box3().setFromObject(object);

    // If box is empty, skip
    if (box.isEmpty()) return false;

    // Get all 8 corners of the bounding box
    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    // Project all corners to screen space and find the 2D bounding box
    let minScreenX = Infinity;
    let minScreenY = Infinity;
    let maxScreenX = -Infinity;
    let maxScreenY = -Infinity;

    for (const corner of corners) {
      // Clone and project the corner
      const projected = corner.clone().project(this.camera);

      // Convert to screen coordinates
      const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

      // Update bounds
      minScreenX = Math.min(minScreenX, screenX);
      minScreenY = Math.min(minScreenY, screenY);
      maxScreenX = Math.max(maxScreenX, screenX);
      maxScreenY = Math.max(maxScreenY, screenY);
    }

    // Check if the 2D bounding boxes intersect (AABB intersection test)
    const intersects =
      selectionRect.left <= maxScreenX &&
      selectionRect.right >= minScreenX &&
      selectionRect.top <= maxScreenY &&
      selectionRect.bottom >= minScreenY;

    return intersects;
  }

  private getTileAtMouse(event: MouseEvent): string | null {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersectableObjects: THREE.Object3D[] = [];
    for (const tile of this.tiles.values()) {
      if (tile.visible) {
        intersectableObjects.push(tile.object);
      }
    }

    const intersects = this.raycaster.intersectObjects(
      intersectableObjects,
      true
    );

    if (intersects.length > 0) {
      // Find which tile this object belongs to
      let intersectedObject = intersects[0].object;
      while (
        intersectedObject.parent &&
        intersectedObject.parent !== this.scene
      ) {
        intersectedObject = intersectedObject.parent;
      }

      for (const [tileId, tile] of this.tiles.entries()) {
        if (tile.object === intersectedObject) {
          return tileId;
        }
      }
    }

    return null;
  }

  private updateSelection(): void {
    // Update visual highlights
    for (const [tileId, tile] of this.tiles.entries()) {
      const isSelected = this.selectedTiles.has(tileId);
      this.setTileHighlight(tile, isSelected);
    }

    // Update UI
    this.selectionInfo.innerHTML = `<strong>${this.selectedTiles.size}</strong> tiles selected`;

    // Update weight input based on selection
    if (this.selectedTiles.size > 0) {
      // Get weights of all selected tiles
      const weights = new Set<number>();
      for (const tileId of this.selectedTiles) {
        const tile = this.tiles.get(tileId);
        if (tile) {
          weights.add(tile.weight);
        }
      }

      // If all selected tiles have the same weight, show it
      if (weights.size === 1) {
        this.weightInput.value = Array.from(weights)[0].toString();
        this.weightInput.placeholder = "";
      } else {
        // Different weights - clear input and show placeholder
        this.weightInput.value = "";
        this.weightInput.placeholder = "Mixed weights";
      }

      // Enable weight controls
      this.weightInput.disabled = false;
      this.applyWeightBtn.disabled = false;

      // Show and populate face dropdowns
      this.faceAssignmentSection.style.display = "block";
      this.updateFaceDropdowns();
    } else {
      // No selection - reset and disable
      this.weightInput.value = "1";
      this.weightInput.placeholder = "1.0";
      this.weightInput.disabled = true;
      this.applyWeightBtn.disabled = true;

      // Hide face dropdowns
      this.faceAssignmentSection.style.display = "none";
    }

    // Update groups list to highlight groups used by selection
    this.updateGroupsList();

    // Update exclusions list to show only selected tiles' exclusions
    this.updateExclusionsList();

    // Update exclusion mode UI based on selection
    this.updateExclusionUI();

    // Enable/disable exclusion mode checkbox based on selection
    this.exclusionModeCheckbox.disabled = this.selectedTiles.size === 0;

    // If exclusion mode is enabled but selection is cleared, disable it
    if (this.exclusionMode && this.selectedTiles.size === 0) {
      this.exclusionModeCheckbox.checked = false;
      this.exclusionMode = false;
      this.exclusionInfo.classList.remove("active");
      this.exclusionNoSelection.style.display = "none";
      this.exclusionActiveInfo.style.display = "none";
    }

    // Automatically update transform controls based on selection
    this.attachTransformControlsToSelection();
  }

  private setTileHighlight(tile: ConnectorTile, highlight: boolean): void {
    tile.object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as any;

        if (Array.isArray(material)) {
          // Handle array of materials
          material.forEach((mat) => {
            if (mat.emissive) {
              if (highlight) {
                if (!mat.userData.originalEmissive) {
                  mat.userData.originalEmissive = mat.emissive.clone();
                  mat.userData.originalEmissiveIntensity =
                    mat.emissiveIntensity;
                }
                mat.emissive.setHex(0xeab308);
                mat.emissiveIntensity = 0.5;
              } else {
                if (mat.userData.originalEmissive) {
                  mat.emissive.copy(mat.userData.originalEmissive);
                  mat.emissiveIntensity =
                    mat.userData.originalEmissiveIntensity || 0;
                }
              }
            }
          });
        } else if (material && material.emissive) {
          // Handle single material
          if (highlight) {
            if (!material.userData.originalEmissive) {
              material.userData.originalEmissive = material.emissive.clone();
              material.userData.originalEmissiveIntensity =
                material.emissiveIntensity;
            }
            material.emissive.setHex(0xeab308);
            material.emissiveIntensity = 0.5;
          } else {
            if (material.userData.originalEmissive) {
              material.emissive.copy(material.userData.originalEmissive);
              material.emissiveIntensity =
                material.userData.originalEmissiveIntensity || 0;
            }
          }
        }
      }
    });
  }

  private cleanMaterialForExport(object: THREE.Object3D): void {
    // Restore all materials to their original state and remove highlight userData
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as any;

        if (Array.isArray(material)) {
          // Handle array of materials
          material.forEach((mat) => {
            if (mat.emissive && mat.userData.originalEmissive) {
              // Restore original emissive values
              mat.emissive.copy(mat.userData.originalEmissive);
              mat.emissiveIntensity =
                mat.userData.originalEmissiveIntensity || 0;
              // Clean up userData
              delete mat.userData.originalEmissive;
              delete mat.userData.originalEmissiveIntensity;
            }
          });
        } else if (
          material &&
          material.emissive &&
          material.userData.originalEmissive
        ) {
          // Handle single material
          material.emissive.copy(material.userData.originalEmissive);
          material.emissiveIntensity =
            material.userData.originalEmissiveIntensity || 0;
          // Clean up userData
          delete material.userData.originalEmissive;
          delete material.userData.originalEmissiveIntensity;
        }
      }
    });
  }

  private getOrAssignGroupColor(groupId: string): THREE.Color {
    if (!this.groupColors.has(groupId)) {
      // Get colors already used
      const usedColors = new Set(
        Array.from(this.groupColors.values()).map((c) => c.getHex())
      );

      // Find available colors
      const availableColors = this.colorPalette.filter(
        (c) => !usedColors.has(c)
      );

      // Pick random color from available, or any random if all used
      const colorPool =
        availableColors.length > 0 ? availableColors : this.colorPalette;
      const randomIndex = Math.floor(Math.random() * colorPool.length);
      const colorHex = colorPool[randomIndex];

      const color = new THREE.Color(colorHex);
      this.groupColors.set(groupId, color);
    }

    return this.groupColors.get(groupId)!;
  }

  private isGroupVisible(groupId: string): boolean {
    // Default to visible if not explicitly set
    return this.groupVisibility.get(groupId) ?? true;
  }

  private setGroupVisibility(groupId: string, visible: boolean): void {
    this.groupVisibility.set(groupId, visible);

    // Update tile visibility - hide tile if ANY of its faces use this group
    for (const tile of this.tiles.values()) {
      const usesGroup =
        tile.connectors.up.groupId === groupId ||
        tile.connectors.down.groupId === groupId ||
        tile.connectors.north.groupId === groupId ||
        tile.connectors.south.groupId === groupId ||
        tile.connectors.east.groupId === groupId ||
        tile.connectors.west.groupId === groupId;

      if (usesGroup) {
        tile.visible = visible;
        tile.voxelCell.visible = visible;
      }
    }

    // Clear selection of hidden tiles
    const tilesToDeselect: string[] = [];
    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile && !tile.visible) {
        tilesToDeselect.push(tileId);
      }
    }
    tilesToDeselect.forEach((id) => this.selectedTiles.delete(id));

    // Update UI
    this.updateSelection();
    if (this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private changeGroupColor(groupId: string): void {
    // Create color picker modal
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const picker = document.createElement("div");
    picker.style.cssText = `
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px;
      max-width: 300px;
    `;

    picker.innerHTML = `
      <h3 style="margin: 0 0 12px 0; color: #f1f5f9;">Choose Color</h3>
      <div id="color-grid" style="
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
      "></div>
      <button id="cancel-color" style="
        margin-top: 12px;
        width: 100%;
        padding: 6px;
        background: #334155;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
      ">Cancel</button>
    `;

    modal.appendChild(picker);
    document.body.appendChild(modal);

    // Populate color grid
    const grid = picker.querySelector("#color-grid")!;
    for (const colorHex of this.colorPalette) {
      const colorBtn = document.createElement("button");
      const color = new THREE.Color(colorHex);
      const hexString = "#" + color.getHexString();

      colorBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: 2px solid #475569;
        border-radius: 4px;
        background: ${hexString};
        cursor: pointer;
        transition: transform 0.1s;
      `;

      colorBtn.onmouseenter = () => {
        colorBtn.style.transform = "scale(1.1)";
      };
      colorBtn.onmouseleave = () => {
        colorBtn.style.transform = "scale(1)";
      };

      colorBtn.onclick = () => {
        this.groupColors.set(groupId, color.clone());
        document.body.removeChild(modal);
        this.updateGroupsList();

        // Update voxel colors
        if (this.showVoxelDebugToggle.checked) {
          this.updateVoxelDebug();
        }
      };

      grid.appendChild(colorBtn);
    }

    // Cancel button
    picker.querySelector("#cancel-color")!.addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    // Click outside to close
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  private updateVoxelDebug(): void {
    // Clear existing debug visualization
    this.debugGrid.clear();

    const halfSize = this.voxelSize / 2;
    const visibleTiles = Array.from(this.tiles.values()).filter(
      (t) => t.visible
    );

    if (visibleTiles.length === 0) return;

    // Define face configurations
    const faceConfigs: Array<{
      direction: keyof TileConnectors;
      position: THREE.Vector3;
      rotation: THREE.Euler;
    }> = [
      {
        direction: "up",
        position: new THREE.Vector3(0, halfSize, 0),
        rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      },
      {
        direction: "down",
        position: new THREE.Vector3(0, -halfSize, 0),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      },
      {
        direction: "north",
        position: new THREE.Vector3(0, 0, halfSize),
        rotation: new THREE.Euler(0, 0, 0),
      },
      {
        direction: "south",
        position: new THREE.Vector3(0, 0, -halfSize),
        rotation: new THREE.Euler(0, Math.PI, 0),
      },
      {
        direction: "east",
        position: new THREE.Vector3(halfSize, 0, 0),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
      },
      {
        direction: "west",
        position: new THREE.Vector3(-halfSize, 0, 0),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      },
    ];

    // Total instances needed: 6 faces per tile
    const instanceCount = visibleTiles.length * 6;

    // Create instanced mesh for planes
    const planeGeometry = new THREE.PlaneGeometry(
      this.voxelSize,
      this.voxelSize
    );
    const planeMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    const planeInstances = new THREE.InstancedMesh(
      planeGeometry,
      planeMaterial,
      instanceCount
    );

    // Set up matrices and colors for each instance
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(0.95, 0.95, 0.95);
    const color = new THREE.Color();

    let instanceIndex = 0;
    for (const tile of visibleTiles) {
      const tilePos = tile.voxelCell.position;

      for (const faceConfig of faceConfigs) {
        const groupId = tile.connectors[faceConfig.direction].groupId;
        const groupColor = this.getOrAssignGroupColor(groupId);

        // Calculate final position (tile position + face offset)
        const finalPos = new THREE.Vector3()
          .copy(faceConfig.position)
          .add(tilePos);

        // Create transformation matrix
        matrix.compose(
          finalPos,
          new THREE.Quaternion().setFromEuler(faceConfig.rotation),
          scale
        );

        // Set matrix for both plane and edge instances
        planeInstances.setMatrixAt(instanceIndex, matrix);

        // Set color for both instances
        color.copy(groupColor);
        planeInstances.setColorAt(instanceIndex, color);

        instanceIndex++;
      }
    }

    // Mark instance attributes as needing update
    planeInstances.instanceMatrix.needsUpdate = true;
    if (planeInstances.instanceColor)
      planeInstances.instanceColor.needsUpdate = true;

    // Add to debug grid's internal group
    const gridGroup = this.scene.getObjectByName("debug_grid");
    if (gridGroup) {
      gridGroup.add(planeInstances);
    }

    // Cleanup geometries (instances keep references)
    planeGeometry.dispose();
  }

  private clearSelection(): void {
    // Exit align mode if active
    if (this.alignMode) {
      this.exitAlignMode();
    }

    this.selectedTiles.clear();
    this.transformControls.detach();
    this.transformStartPositions.clear();
    // Reset helper position
    this.transformHelper.position.set(0, 0, 0);
    this.updateSelection();
  }

  // ====================
  // Connector Groups Management (Global Groups)
  // ====================

  // Get the currently selected face from the face selector dropdown
  private getSelectedFace(): keyof TileConnectors {
    return this.faceSelector.value as keyof TileConnectors;
  }

  private getAllGroupIds(): Set<string> {
    const groups = new Set<string>();

    // Collect all groups from all tiles on all faces
    for (const tile of this.tiles.values()) {
      groups.add(tile.connectors.up.groupId);
      groups.add(tile.connectors.down.groupId);
      groups.add(tile.connectors.north.groupId);
      groups.add(tile.connectors.south.groupId);
      groups.add(tile.connectors.east.groupId);
      groups.add(tile.connectors.west.groupId);
    }

    // Add empty groups
    for (const groupId of this.emptyGroups) {
      groups.add(groupId);
    }

    return groups;
  }

  private updateGroupsList(): void {
    const groupIds = this.getAllGroupIds();

    if (groupIds.size === 0) {
      this.groupsList.innerHTML =
        '<em style="padding: 8px; display: block; color: #94a3b8">No groups</em>';
      return;
    }

    // Get groups used by currently selected tiles (on any face)
    const selectedGroups = new Set<string>();
    if (this.selectedTiles.size > 0) {
      const faces: Array<keyof TileConnectors> = [
        "up",
        "down",
        "north",
        "south",
        "east",
        "west",
      ];
      for (const tileId of this.selectedTiles) {
        const tile = this.tiles.get(tileId);
        if (tile) {
          for (const face of faces) {
            selectedGroups.add(tile.connectors[face].groupId);
          }
        }
      }
    }

    const groupsArray = Array.from(groupIds).sort();
    let html = "";

    for (const groupId of groupsArray) {
      const tileCount = this.getTileCountInGroup(groupId);
      const faceCount = this.getFaceCountForGroup(groupId);
      const isUsedBySelection = selectedGroups.has(groupId);

      // Get color for this group
      const groupColor = this.getOrAssignGroupColor(groupId);
      const colorHex = "#" + groupColor.getHexString();

      // Check if this is an empty group
      const isEmpty = tileCount === 0;

      html += `
        <div class="group-item" data-group-id="${groupId}" style="
          padding: 8px;
          margin: 4px 0;
          border: 1px solid ${isUsedBySelection ? "#6366f1" : "#334155"};
          border-radius: 4px;
          background: ${
            isUsedBySelection ? "rgba(99, 102, 241, 0.1)" : "transparent"
          };
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.2s;
        "
          title="${
            isEmpty
              ? "Empty group - click to select"
              : `Click to select all ${tileCount} tiles (${faceCount} face assignments)`
          }"
        >
          <div style="flex: 1; display: flex; align-items: center; gap: 8px; pointer-events: none;">
            <input 
              type="checkbox" 
              class="visibility-toggle" 
              data-group-id="${groupId}"
              ${this.isGroupVisible(groupId) ? "checked" : ""}
              style="cursor: pointer; pointer-events: auto;"
              title="Toggle visibility"
            />
            <div 
              class="color-thumbnail" 
              data-group-id="${groupId}"
              style="
              width: 16px;
              height: 16px;
              background: ${colorHex};
              border: 2px solid #475569;
              border-radius: 3px;
              flex-shrink: 0;
              cursor: pointer;
              transition: transform 0.1s;
              pointer-events: auto;
            "
              title="Click to change color"
            ></div>
            <span 
              class="group-name-edit" 
              contenteditable="true" 
              data-group-id="${groupId}"
              style="
                font-weight: 500;
                padding: 2px 4px;
                border-radius: 3px;
                outline: none;
                cursor: text;
                pointer-events: auto;
              "
              onmousedown="event.stopPropagation()"
            >${groupId}</span>
            <span style="color: #94a3b8; font-size: 11px; white-space: nowrap">${tileCount} tiles / ${faceCount} faces</span>
          </div>
          <div style="display: flex; gap: 4px; pointer-events: auto;">
            <button class="delete-btn" data-group-id="${groupId}" ${
        isEmpty ? "" : "disabled"
      } style="
              padding: 3px 8px;
              font-size: 11px;
              background: ${isEmpty ? "#ef4444" : "#64748b"};
              border: none;
              border-radius: 3px;
              color: white;
              cursor: ${isEmpty ? "pointer" : "not-allowed"};
              opacity: ${isEmpty ? "1" : "0.5"};
            " title="${
              isEmpty
                ? "Delete empty group"
                : "Cannot delete: group has assigned tiles"
            }">×</button>
          </div>
        </div>
      `;
    }

    this.groupsList.innerHTML = html;
  }

  private getTileCountInGroup(groupId: string): number {
    let count = 0;
    for (const tile of this.tiles.values()) {
      // Check if this group is used on ANY face of the tile
      const faces: Array<keyof TileConnectors> = [
        "up",
        "down",
        "north",
        "south",
        "east",
        "west",
      ];
      for (const face of faces) {
        if (tile.connectors[face].groupId === groupId) {
          count++;
          break; // Count each tile only once
        }
      }
    }
    return count;
  }

  private getFaceCountForGroup(groupId: string): number {
    let count = 0;
    const faces: Array<keyof TileConnectors> = [
      "up",
      "down",
      "north",
      "south",
      "east",
      "west",
    ];

    for (const tile of this.tiles.values()) {
      for (const face of faces) {
        if (tile.connectors[face].groupId === groupId) {
          count++; // Count each face assignment
        }
      }
    }
    return count;
  }

  private createGroup(): void {
    // Generate unique group name
    const name = `group_${this.nextGroupId}`;
    this.nextGroupId++;

    // Add to empty groups (global)
    this.emptyGroups.add(name);

    console.log(`✓ Created empty group "${name}"`);
    this.updateGroupsList();
  }

  private renameGroup(oldGroupId: string, newGroupId: string): void {
    const existingGroups = this.getAllGroupIds();

    if (existingGroups.has(newGroupId) && newGroupId !== oldGroupId) {
      alert("A group with this name already exists");
      this.updateGroupsList(); // Reset to old name
      return;
    }

    // Update tiles using this group on ANY face
    let updatedCount = 0;
    const faces: Array<keyof TileConnectors> = [
      "up",
      "down",
      "north",
      "south",
      "east",
      "west",
    ];
    for (const tile of this.tiles.values()) {
      for (const face of faces) {
        if (tile.connectors[face].groupId === oldGroupId) {
          tile.connectors[face].groupId = newGroupId;
          updatedCount++;
        }
      }
    }

    // Update empty groups if this is an empty group
    if (this.emptyGroups.has(oldGroupId)) {
      this.emptyGroups.delete(oldGroupId);
      this.emptyGroups.add(newGroupId);
    }

    // Transfer color from old group to new group
    if (this.groupColors.has(oldGroupId)) {
      const color = this.groupColors.get(oldGroupId)!;
      this.groupColors.delete(oldGroupId);
      this.groupColors.set(newGroupId, color);
    }

    console.log(
      `✓ Renamed group "${oldGroupId}" → "${newGroupId}" (${updatedCount} tiles)`
    );
    this.updateGroupsList();

    // Update voxel colors if tiles were renamed
    if (updatedCount > 0 && this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private deleteGroup(groupId: string): void {
    const tileCount = this.getTileCountInGroup(groupId);

    // Only allow deleting empty groups (button should be disabled for non-empty)
    if (tileCount > 0) {
      console.warn(
        `⚠ Cannot delete group "${groupId}": Used by ${tileCount} tile(s)`
      );
      return;
    }

    // Remove from empty groups and clean up color
    this.emptyGroups.delete(groupId);
    this.groupColors.delete(groupId);

    console.log(`✓ Deleted empty group "${groupId}"`);
    this.updateGroupsList();
  }

  // Removed: Old assignToGroup method - now using assignGroupToFace with explicit face parameter

  private selectAllInGroup(groupId: string): void {
    const face = this.getSelectedFace();

    this.selectedTiles.clear();

    for (const [tileId, tile] of this.tiles.entries()) {
      if (tile.connectors[face].groupId === groupId) {
        this.selectedTiles.add(tileId);
      }
    }

    if (this.selectedTiles.size === 0) {
      console.log(`✓ Group "${groupId}" has no tiles to select`);
    } else {
      console.log(
        `✓ Selected ${this.selectedTiles.size} tiles in group "${groupId}"`
      );
    }

    this.updateSelection();
  }

  private assignGroupToFace(groupId: string, face: keyof TileConnectors): void {
    // Track old groups before reassignment
    const oldGroups = new Set<string>();
    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        oldGroups.add(tile.connectors[face].groupId);
      }
    }

    // Assign the group to the specified face of all selected tiles
    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.connectors[face].groupId = groupId;
      }
    }

    // Remove the newly assigned group from empty groups (it's no longer empty)
    this.emptyGroups.delete(groupId);

    // Check if any old groups became empty and add them to emptyGroups
    for (const oldGroupId of oldGroups) {
      if (oldGroupId === groupId) continue; // Skip if it's the same group

      const tileCount = this.getTileCountInGroup(oldGroupId);
      if (tileCount === 0) {
        this.emptyGroups.add(oldGroupId);
        console.log(`✓ Group "${oldGroupId}" is now empty (not deleted)`);
      }
    }

    console.log(
      `✓ Assigned group "${groupId}" to ${face} face of ${this.selectedTiles.size} tiles`
    );

    // Update UI
    this.updateGroupsList();
    if (this.showVoxelDebugToggle.checked) {
      this.updateVoxelDebug();
    }
  }

  private updateFaceDropdowns(): void {
    // Get all available groups
    const allGroups = this.getAllGroupIds();

    // Populate each dropdown with all available groups
    for (const [face, dropdown] of this.faceDropdowns) {
      // Clear existing options
      dropdown.innerHTML = "";

      // Add options for each group
      for (const groupId of Array.from(allGroups).sort()) {
        const option = document.createElement("option");
        option.value = groupId;
        option.textContent = groupId;
        dropdown.appendChild(option);
      }

      // Set the selected value based on current selection
      if (this.selectedTiles.size > 0) {
        // Get the group ID for this face from the first selected tile
        const firstTileId = Array.from(this.selectedTiles)[0];
        const firstTile = this.tiles.get(firstTileId);

        if (firstTile) {
          const currentGroupId = firstTile.connectors[face].groupId;

          // Check if all selected tiles have the same group for this face
          let allSame = true;
          for (const tileId of this.selectedTiles) {
            const tile = this.tiles.get(tileId);
            if (tile && tile.connectors[face].groupId !== currentGroupId) {
              allSame = false;
              break;
            }
          }

          if (allSame) {
            dropdown.value = currentGroupId;
          } else {
            // Mixed values - add a placeholder option
            const mixedOption = document.createElement("option");
            mixedOption.value = "";
            mixedOption.textContent = "(Mixed)";
            mixedOption.disabled = true;
            mixedOption.selected = true;
            dropdown.insertBefore(mixedOption, dropdown.firstChild);
          }
        }
      }
    }
  }

  private applyRotation(): void {
    const rotationRadio = document.querySelector(
      'input[name="rotation"]:checked'
    ) as HTMLInputElement;

    if (!rotationRadio) {
      alert("Please select a rotation value");
      return;
    }

    const rotation = rotationRadio.value as ConnectorData["rotation"];
    const face = this.getSelectedFace();

    if (face !== "up" && face !== "down") {
      alert("Rotation only applies to vertical faces (up/down)");
      return;
    }

    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.connectors[face].rotation = rotation;
      }
    }

    console.log(
      `✓ Applied rotation "${rotation}" to ${this.selectedTiles.size} tiles`
    );
  }

  private applySymmetry(): void {
    const symmetryRadio = document.querySelector(
      'input[name="symmetry"]:checked'
    ) as HTMLInputElement;

    if (!symmetryRadio) {
      alert("Please select a symmetry value");
      return;
    }

    const symmetry = symmetryRadio.value as ConnectorData["symmetry"];
    const face = this.getSelectedFace();

    if (face === "up" || face === "down") {
      alert(
        "Symmetry only applies to horizontal faces (north/south/east/west)"
      );
      return;
    }

    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.connectors[face].symmetry = symmetry;
      }
    }

    console.log(
      `✓ Applied symmetry "${symmetry}" to ${this.selectedTiles.size} tiles`
    );
  }

  private applyWeight(): void {
    if (this.selectedTiles.size === 0) {
      alert("Please select tiles first");
      return;
    }

    const weight = parseFloat(this.weightInput.value);

    if (isNaN(weight) || weight <= 0) {
      alert("Please enter a valid weight value (greater than 0)");
      return;
    }

    // Apply weight to all selected tiles
    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.weight = weight;
      }
    }

    console.log(
      `✓ Applied weight ${weight} to ${this.selectedTiles.size} tile(s)`
    );
  }

  // ====================
  // End Connector Groups Management
  // ====================

  // ====================
  // Align Mode
  // ====================

  private enterAlignMode(): void {
    this.alignMode = true;
    this.orbitControls.enabled = false; // Disable orbit during align
    console.log("✓ Align mode: Move cursor and click to place");

    // Change cursor style
    this.renderer.domElement.style.cursor = "crosshair";

    // Store initial positions for multi-selection
    if (this.selectedTiles.size > 1) {
      // Calculate bounding box center
      const bbox = new THREE.Box3();
      for (const tileId of this.selectedTiles) {
        const tile = this.tiles.get(tileId);
        if (tile) {
          bbox.expandByObject(tile.voxelCell);
          // Store start position
          this.transformStartPositions.set(
            tileId,
            tile.voxelCell.position.clone()
          );
        }
      }

      const center = new THREE.Vector3();
      bbox.getCenter(center);

      // Position helper at center
      this.transformHelper.position.copy(center);
      this.transformHelperStartPos.copy(center);
    }
  }

  private exitAlignMode(): void {
    this.alignMode = false;
    this.orbitControls.enabled = true;
    this.renderer.domElement.style.cursor = "default";
    console.log("✓ Align mode cancelled");
  }

  private updateAlignPosition(event: MouseEvent): void {
    if (!this.alignMode) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Raycast to find intersection with XZ plane
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersectionPoint = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(this.alignPlane, intersectionPoint)) {
      // Update position based on selection (single tile or group)
      if (this.selectedTiles.size === 1) {
        const tileId = Array.from(this.selectedTiles)[0];
        const tile = this.tiles.get(tileId);
        if (tile) {
          tile.voxelCell.position.x = intersectionPoint.x;
          tile.voxelCell.position.z = intersectionPoint.z;
        }
      } else if (this.selectedTiles.size > 1) {
        // Move the transform helper, which will move all selected tiles
        this.transformHelper.position.x = intersectionPoint.x;
        this.transformHelper.position.z = intersectionPoint.z;

        // Update individual tile positions based on helper
        for (const tileId of this.selectedTiles) {
          const tile = this.tiles.get(tileId);
          if (tile) {
            const startPos = this.transformStartPositions.get(tileId);
            if (startPos) {
              const helperDelta = new THREE.Vector3().subVectors(
                this.transformHelper.position,
                this.transformHelperStartPos
              );
              tile.voxelCell.position.copy(startPos).add(helperDelta);
            }
          }
        }
      }

      // Update voxel debug if enabled
      if (this.showVoxelDebugToggle.checked) {
        this.updateVoxelDebug();
      }
    }
  }

  private finalizeAlignPosition(): void {
    if (!this.alignMode) return;

    // Update grid positions for all selected tiles
    for (const tileId of this.selectedTiles) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.gridPosition.set(
          Math.round(tile.voxelCell.position.x / this.gridSpacing),
          Math.round(tile.voxelCell.position.z / this.gridSpacing)
        );
        tile.manuallyPositioned = true;
      }
    }

    console.log(`✓ Positioned ${this.selectedTiles.size} tiles`);
    this.exitAlignMode();
  }

  // ====================
  // End Align Mode
  // ====================

  private isTypingInInputField(): boolean {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    const isContentEditable =
      activeElement.getAttribute("contenteditable") === "true";

    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      isContentEditable
    );
  }

  private onKeyDown(event: KeyboardEvent): void {
    // ESC always works (to exit modes and close things)
    if (event.key === "Escape") {
      if (this.alignMode) {
        this.exitAlignMode();
        return;
      }
      this.clearSelection();
      return;
    }

    // Skip other keyboard shortcuts when typing in input fields
    if (this.isTypingInInputField()) {
      return;
    }

    // Quick camera views (1-4)
    if (event.key === "1") {
      // Top view
      const target = new THREE.Vector3(0, 0, 0);
      const position = new THREE.Vector3(0, 20, 0);
      this.setCameraView(position, target);
      console.log("📷 Camera: Top view");
      return;
    }
    if (event.key === "2") {
      // Front view
      const target = new THREE.Vector3(0, 0, 0);
      const position = new THREE.Vector3(0, 5, 20);
      this.setCameraView(position, target);
      console.log("📷 Camera: Front view");
      return;
    }
    if (event.key === "3") {
      // Right side view
      const target = new THREE.Vector3(0, 0, 0);
      const position = new THREE.Vector3(20, 5, 0);
      this.setCameraView(position, target);
      console.log("📷 Camera: Right side view");
      return;
    }
    if (event.key === "4") {
      // Left side view
      const target = new THREE.Vector3(0, 0, 0);
      const position = new THREE.Vector3(-20, 5, 0);
      this.setCameraView(position, target);
      console.log("📷 Camera: Left side view");
      return;
    }

    // G - Toggle transform mode
    if (event.key === "g" || event.key === "G") {
      this.transformMode = !this.transformMode;
      this.attachTransformControlsToSelection();
      console.log(`Transform mode: ${this.transformMode ? "ON" : "OFF"}`);
    }

    // A - Align mode (follow cursor)
    if (event.key === "a" || event.key === "A") {
      if (this.selectedTiles.size > 0 && this.transformMode) {
        this.enterAlignMode();
      } else if (this.selectedTiles.size === 0) {
        console.log("⚠ Select tiles first to use align mode");
      } else if (!this.transformMode) {
        console.log("⚠ Enable transform mode (G) first to use align");
      }
    }
  }

  // Exclusion System
  private handleExclusionClick(event: MouseEvent): void {
    // Check if tiles are selected
    if (this.selectedTiles.size === 0) {
      console.warn("⚠ Please select tiles first before adding exclusions");
      return;
    }

    const targetTileId = this.getTileAtMouse(event);
    if (!targetTileId) return;

    // Don't add exclusions to itself
    if (this.selectedTiles.has(targetTileId)) {
      console.warn("⚠ Cannot add exclusion to selected tile itself");
      return;
    }

    // Get the current face direction
    const direction = this.getSelectedFace();

    // Add bidirectional exclusion to ALL selected tiles
    const targetTile = this.tiles.get(targetTileId);
    if (!targetTile) {
      console.warn("Target tile not found");
      return;
    }

    const oppositeDir = this.getOppositeDirection(direction);
    let addedCount = 0;

    for (const sourceTileId of this.selectedTiles) {
      const sourceTile = this.tiles.get(sourceTileId);
      if (sourceTile) {
        // Check if forward exclusion already exists
        const forwardExists = sourceTile.exclusions.some(
          (ex) => ex.targetTileId === targetTileId && ex.direction === direction
        );

        // Check if reverse exclusion already exists
        const reverseExists = targetTile.exclusions.some(
          (ex) =>
            ex.targetTileId === sourceTileId && ex.direction === oppositeDir
        );

        if (!forwardExists) {
          // Add forward exclusion: sourceTile cannot be [direction] of targetTile
          sourceTile.exclusions.push({
            targetTileId: targetTileId,
            direction: direction,
          });
        }

        if (!reverseExists) {
          // Add reverse exclusion: targetTile cannot be [oppositeDir] of sourceTile
          targetTile.exclusions.push({
            targetTileId: sourceTileId,
            direction: oppositeDir,
          });
        }

        if (!forwardExists || !reverseExists) {
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      console.log(
        `✓ Added bidirectional exclusion for ${addedCount} tile(s): ${
          this.selectedTiles.size > 0
            ? Array.from(this.selectedTiles)[0]
            : "selected"
        } <-> ${targetTileId}`
      );
      this.updateExclusionsList();
    } else {
      console.log(`⚠ Exclusions already exist for all selected tiles`);
    }
  }

  private updateExclusionUI(): void {
    if (!this.exclusionMode) return;

    if (this.selectedTiles.size === 0) {
      // No selection - show warning
      this.exclusionNoSelection.style.display = "block";
      this.exclusionActiveInfo.style.display = "none";
    } else {
      // Has selection - show active info
      this.exclusionNoSelection.style.display = "none";
      this.exclusionActiveInfo.style.display = "block";
      this.exclusionSelectedCount.textContent =
        this.selectedTiles.size.toString();
      this.exclusionCurrentFace.textContent = this.getSelectedFace();
    }
  }

  private updateExclusionsList(): void {
    let html = "";

    // Show exclusions only for selected tiles
    if (this.selectedTiles.size === 0) {
      html =
        "<em style='color: #94a3b8'>Select tiles to view their exclusions</em>";
    } else {
      let hasAnyExclusions = false;

      for (const tileId of this.selectedTiles) {
        const tile = this.tiles.get(tileId);
        if (tile && tile.exclusions.length > 0) {
          hasAnyExclusions = true;
          html += `<div style="margin-bottom: 10px"><strong>${tile.id}:</strong>`;
          for (let i = 0; i < tile.exclusions.length; i++) {
            const exclusion = tile.exclusions[i];
            html += `
              <div class="exclusion-item">
                <span>cannot be ${exclusion.direction} of ${exclusion.targetTileId}</span>
                <button class="exclusion-remove" data-tile="${tile.id}" data-index="${i}">×</button>
              </div>
            `;
          }
          html += "</div>";
        }
      }

      if (!hasAnyExclusions) {
        html =
          "<em style='color: #94a3b8'>Selected tiles have no exclusions</em>";
      }
    }

    this.exclusionsList.innerHTML = html;

    // Add removal handlers
    const removeBtns =
      this.exclusionsList.querySelectorAll(".exclusion-remove");
    removeBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tileId = (e.target as HTMLElement).dataset.tile;
        const index = parseInt((e.target as HTMLElement).dataset.index || "0");
        const tile = this.tiles.get(tileId!);
        if (tile) {
          tile.exclusions.splice(index, 1);
          this.updateExclusionsList();
        }
      });
    });
  }

  // Auto-Generate Adjacencies removed: adjacencies are computed dynamically during WFC
  // The connector compatibility logic is now in WFCTile3D.canBeAdjacentTo()

  // Removed canConnect, checkRotationCompatibility, checkSymmetryCompatibility, hasExclusion
  // These are now handled by WFCTile3D.canBeAdjacentTo()

  private getOppositeDirection(direction: string): keyof TileConnectors {
    return OPPOSITE_DIRECTIONS[direction] as keyof TileConnectors;
  }

  // Export Functions
  private handleExportJSON(): void {
    const json = this.exportToJSON();
    downloadJSON(json, "connector-adjacency-config.json");
  }

  private exportToJSON(): string {
    const configs: any[] = [];

    for (const tile of this.tiles.values()) {
      const config: any = {
        id: tile.id,
        weight: tile.weight,
        model:
          typeof tile.model === "string" ? tile.model : tile.model.toString(),
        connectors: tile.connectors,
        exclusions: tile.exclusions,
        adjacency: this.buildAdjacencyForExport(tile),
      };

      configs.push(config);
    }

    return JSON.stringify(configs, null, 2);
  }

  private buildAdjacencyForExport(tile: ConnectorTile): any {
    const adjacency: any = {};

    if (tile.adjacency.up.size > 0) {
      adjacency.up = Array.from(tile.adjacency.up);
    }
    if (tile.adjacency.down.size > 0) {
      adjacency.down = Array.from(tile.adjacency.down);
    }
    if (tile.adjacency.north.size > 0) {
      adjacency.north = Array.from(tile.adjacency.north);
    }
    if (tile.adjacency.south.size > 0) {
      adjacency.south = Array.from(tile.adjacency.south);
    }
    if (tile.adjacency.east.size > 0) {
      adjacency.east = Array.from(tile.adjacency.east);
    }
    if (tile.adjacency.west.size > 0) {
      adjacency.west = Array.from(tile.adjacency.west);
    }

    return adjacency;
  }

  private async handleExportGLB(): Promise<void> {
    try {
      this.loadingOverlay.classList.add("active");

      if (this.directoryHandle) {
        await this.exportToDirectory();
      } else {
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
    // Group tiles by source file
    const tilesByFile = new Map<string, ConnectorTile[]>();
    for (const tile of this.tiles.values()) {
      const sourceFile = tile.sourceFile || tile.id;
      if (!tilesByFile.has(sourceFile)) {
        tilesByFile.set(sourceFile, []);
      }
      tilesByFile.get(sourceFile)!.push(tile);
    }

    // Export each source file
    for (const [sourceFile, tiles] of tilesByFile.entries()) {
      const scene = new THREE.Scene();

      for (const tile of tiles) {
        // Extract the mesh from the group wrapper
        const mesh = tile.object.children[0];
        if (mesh) {
          const clonedMesh = mesh.clone();

          // Clean any highlight materials before export
          this.cleanMaterialForExport(clonedMesh);

          // Add connector data to the mesh's userData
          clonedMesh.userData = {
            tileId: tile.id,
            weight: tile.weight,
            connectors: tile.connectors,
            exclusions: tile.exclusions,
            adjacency: this.buildAdjacencyForExport(tile),
          };

          scene.add(clonedMesh);
        }
      }

      const arrayBuffer = await exportSceneToGLB(scene);

      const fileHandle = this.fileHandles.get(sourceFile);
      if (fileHandle) {
        await saveGLBToFileHandle(
          fileHandle,
          arrayBuffer,
          `${sourceFile} (${tiles.length} tile(s))`
        );
      } else {
        console.warn(`No file handle for ${sourceFile}, skipping`);
      }
    }
  }

  private async exportAsDownloads(): Promise<void> {
    // Group tiles by source file
    const tilesByFile = new Map<string, ConnectorTile[]>();
    for (const tile of this.tiles.values()) {
      const sourceFile = tile.sourceFile || tile.id;
      if (!tilesByFile.has(sourceFile)) {
        tilesByFile.set(sourceFile, []);
      }
      tilesByFile.get(sourceFile)!.push(tile);
    }

    // Export each source file
    for (const [sourceFile, tiles] of tilesByFile.entries()) {
      const scene = new THREE.Scene();

      for (const tile of tiles) {
        // Extract the mesh from the group wrapper
        const mesh = tile.object.children[0];
        if (mesh) {
          const clonedMesh = mesh.clone();

          // Clean any highlight materials before export
          this.cleanMaterialForExport(clonedMesh);

          // Add connector data to the mesh's userData
          clonedMesh.userData = {
            tileId: tile.id,
            weight: tile.weight,
            connectors: tile.connectors,
            exclusions: tile.exclusions,
            adjacency: this.buildAdjacencyForExport(tile),
          };

          scene.add(clonedMesh);
        }
      }

      const arrayBuffer = await exportSceneToGLB(scene);
      await downloadGLB(arrayBuffer, sourceFile);

      console.log(`✓ Downloaded: ${sourceFile}.glb (${tiles.length} tile(s))`);
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.renderer.dispose();
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.debugGrid.dispose();
    if (this.uiContainer) {
      this.uiContainer.remove();
    }
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
    }
    if (this.selectionBox) {
      this.selectionBox.remove();
    }
    this.renderer.domElement.remove();
  }
}
