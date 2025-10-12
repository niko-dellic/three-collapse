import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { simpleModelTileset } from "../tiles/models/tileset";
import { GLBTileLoader } from "../../src/loaders/GLBTileLoader";
import { InstancedModelRenderer } from "../../src/renderers/InstancedModelRenderer";
import type { ModelTile3DConfig } from "../../src/wfc3d";

// Worker types
interface ProgressMessage {
  type: "progress";
  progress: number;
}

interface CompleteMessage {
  type: "complete";
  success: boolean;
  data?: string[][][];
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

class ModelDemo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private worker: Worker | null = null;

  private glbLoader: GLBTileLoader;
  private modelRenderer: InstancedModelRenderer | null = null;

  private width = 10;
  private height = 8;
  private depth = 10;
  private cellSize = 1;

  private tiles: ModelTile3DConfig[];
  private currentSeed: number = Date.now();
  private isLoading: boolean = false;

  constructor() {
    this.tiles = simpleModelTileset;
    this.glbLoader = new GLBTileLoader();

    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 15, 40);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(15, 12, 15);
    this.camera.lookAt(0, 0, 0);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Add hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.3);
    this.scene.add(hemiLight);

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x2a2a3e,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Setup UI
    this.setupUI();

    // Handle window resize
    window.addEventListener("resize", () => this.onWindowResize());

    // Start animation
    this.animate();

    // Show loading instructions
    this.showLoadingInstructions();
  }

  private setupUI(): void {
    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.style.position = "absolute";
    uiContainer.style.top = "10px";
    uiContainer.style.left = "10px";
    uiContainer.style.padding = "15px";
    uiContainer.style.backgroundColor = "rgba(26, 26, 46, 0.9)";
    uiContainer.style.color = "white";
    uiContainer.style.fontFamily = "monospace";
    uiContainer.style.borderRadius = "5px";
    uiContainer.style.zIndex = "1000";
    uiContainer.style.minWidth = "250px";
    document.body.appendChild(uiContainer);

    // Title
    const title = document.createElement("h2");
    title.textContent = "3D Model WFC Demo";
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "18px";
    uiContainer.appendChild(title);

    // Info
    const info = document.createElement("div");
    info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
    info.style.marginBottom = "10px";
    info.style.fontSize = "12px";
    uiContainer.appendChild(info);

    // Seed input
    const seedContainer = document.createElement("div");
    seedContainer.style.marginBottom = "10px";

    const seedLabel = document.createElement("label");
    seedLabel.textContent = "Seed: ";
    seedLabel.style.fontSize = "12px";
    seedContainer.appendChild(seedLabel);

    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = this.currentSeed.toString();
    seedInput.style.width = "120px";
    seedInput.style.padding = "5px";
    seedInput.addEventListener("change", () => {
      this.currentSeed = parseInt(seedInput.value) || Date.now();
    });
    seedContainer.appendChild(seedInput);

    uiContainer.appendChild(seedContainer);

    // Generate button
    const generateBtn = document.createElement("button");
    generateBtn.textContent = "Generate";
    generateBtn.style.padding = "10px 20px";
    generateBtn.style.marginRight = "5px";
    generateBtn.style.cursor = "pointer";
    generateBtn.style.backgroundColor = "#4a5568";
    generateBtn.style.color = "white";
    generateBtn.style.border = "none";
    generateBtn.style.borderRadius = "3px";
    generateBtn.addEventListener("click", () => this.generate());
    uiContainer.appendChild(generateBtn);

    // Random seed button
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "Random";
    randomBtn.style.padding = "10px 20px";
    randomBtn.style.cursor = "pointer";
    randomBtn.style.backgroundColor = "#4a5568";
    randomBtn.style.color = "white";
    randomBtn.style.border = "none";
    randomBtn.style.borderRadius = "3px";
    randomBtn.addEventListener("click", () => {
      this.currentSeed = Date.now();
      seedInput.value = this.currentSeed.toString();
    });
    uiContainer.appendChild(randomBtn);

    // Status display
    const statusContainer = document.createElement("div");
    statusContainer.style.marginTop = "15px";
    statusContainer.style.padding = "10px";
    statusContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    statusContainer.style.borderRadius = "3px";
    statusContainer.style.fontSize = "11px";
    statusContainer.style.display = "none";

    const statusText = document.createElement("div");
    statusText.textContent = "Status: Ready";
    statusContainer.appendChild(statusText);

    const progressBar = document.createElement("div");
    progressBar.style.width = "100%";
    progressBar.style.height = "20px";
    progressBar.style.backgroundColor = "#2a2a3e";
    progressBar.style.borderRadius = "3px";
    progressBar.style.overflow = "hidden";
    progressBar.style.marginTop = "5px";

    const progressFill = document.createElement("div");
    progressFill.style.width = "0%";
    progressFill.style.height = "100%";
    progressFill.style.backgroundColor = "#4ade80";
    progressFill.style.transition = "width 0.3s";
    progressBar.appendChild(progressFill);

    statusContainer.appendChild(progressBar);
    uiContainer.appendChild(statusContainer);

    // Store references
    (this as any).statusContainer = statusContainer;
    (this as any).statusText = statusText;
    (this as any).progressFill = progressFill;
    (this as any).generateBtn = generateBtn;
    (this as any).randomBtn = randomBtn;
  }

  private showLoadingInstructions(): void {
    const instructions = document.createElement("div");
    instructions.style.position = "absolute";
    instructions.style.top = "50%";
    instructions.style.left = "50%";
    instructions.style.transform = "translate(-50%, -50%)";
    instructions.style.padding = "30px";
    instructions.style.backgroundColor = "rgba(26, 26, 46, 0.95)";
    instructions.style.color = "white";
    instructions.style.fontFamily = "monospace";
    instructions.style.borderRadius = "10px";
    instructions.style.maxWidth = "500px";
    instructions.style.zIndex = "2000";
    instructions.style.textAlign = "center";

    instructions.innerHTML = `
      <h2 style="margin-top: 0; color: #4ade80;">Model-Based WFC Demo</h2>
      <p style="font-size: 14px; line-height: 1.6;">
        This demo uses 3D models (GLB files) instead of voxels.<br><br>
        <strong>Note:</strong> You need to provide GLB model files in the <code>/public/models/</code> directory.
        The tileset references these files.<br><br>
        Place the following models:<br>
        • block.glb<br>
        • base.glb<br>
        • empty.glb (optional placeholder)<br><br>
        You can find free models at:<br>
        <a href="https://kenney.nl/assets" target="_blank" style="color: #4ade80;">Kenney.nl</a> | 
        <a href="https://quaternius.com/" target="_blank" style="color: #4ade80;">Quaternius</a> | 
        <a href="https://poly.pizza/" target="_blank" style="color: #4ade80;">Poly Pizza</a>
      </p>
      <button id="closeInstructions" style="
        padding: 10px 30px;
        margin-top: 15px;
        cursor: pointer;
        background-color: #4ade80;
        color: #1a1a2e;
        border: none;
        border-radius: 5px;
        font-weight: bold;
        font-size: 14px;
      ">Got it!</button>
    `;

    document.body.appendChild(instructions);

    document
      .getElementById("closeInstructions")
      ?.addEventListener("click", () => {
        instructions.remove();
      });
  }

  private async generate(): Promise<void> {
    if (this.isLoading) return;

    const statusContainer = (this as any).statusContainer as HTMLDivElement;
    const statusText = (this as any).statusText as HTMLDivElement;
    const progressFill = (this as any).progressFill as HTMLDivElement;
    const generateBtn = (this as any).generateBtn as HTMLButtonElement;
    const randomBtn = (this as any).randomBtn as HTMLButtonElement;

    this.isLoading = true;
    statusContainer.style.display = "block";
    statusText.textContent = "Loading models...";
    progressFill.style.width = "0%";
    generateBtn.disabled = true;
    randomBtn.disabled = true;

    try {
      // Load models
      statusText.textContent = "Loading GLB models...";
      const modelData = await this.glbLoader.loadTileset(this.tiles);
      progressFill.style.width = "30%";

      // Clear existing renderer
      if (this.modelRenderer) {
        this.modelRenderer.dispose();
      }

      // Create new renderer with loaded models
      this.modelRenderer = new InstancedModelRenderer(
        this.scene,
        modelData,
        this.cellSize
      );

      // Set offset to center the grid
      this.modelRenderer.setOffset(
        (-this.width * this.cellSize) / 2,
        (-this.height * this.cellSize) / 2,
        (-this.depth * this.cellSize) / 2
      );

      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(
          new URL("../../src/wfc.worker.ts", import.meta.url),
          { type: "module" }
        );
      }

      // Run WFC algorithm
      statusText.textContent = "Running WFC algorithm...";
      const result = await new Promise<string[][][]>((resolve, reject) => {
        if (!this.worker) return reject(new Error("Worker not initialized"));

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const message = e.data;

          if (message.type === "progress") {
            const progress = 30 + message.progress * 60; // 30-90%
            progressFill.style.width = `${progress}%`;
          } else if (message.type === "complete") {
            if (message.success && message.data) {
              resolve(message.data);
            } else {
              reject(new Error("Generation failed - contradiction occurred"));
            }
          } else if (message.type === "error") {
            reject(new Error(message.message));
          }
        };

        // Send generation request
        this.worker.postMessage({
          type: "generate",
          width: this.width,
          height: this.height,
          depth: this.depth,
          tiles: this.tiles,
          seed: this.currentSeed,
        });
      });

      // Render using instanced meshes
      statusText.textContent = "Rendering instances...";
      progressFill.style.width = "95%";

      // Filter out 'air' tiles before rendering
      const filteredGrid = result.map((xLayer) =>
        xLayer.map((yLayer) =>
          yLayer.map((tileId) => (tileId === "air" ? "" : tileId))
        )
      );

      this.modelRenderer.render(filteredGrid);

      const stats = this.modelRenderer.getStats();
      statusText.textContent = `Complete! ${stats.totalInstances} instances, ${stats.tileTypes} types`;
      progressFill.style.width = "100%";

      setTimeout(() => {
        statusContainer.style.display = "none";
      }, 2000);
    } catch (error) {
      console.error("Generation error:", error);
      statusText.textContent = `Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      progressFill.style.width = "0%";
      progressFill.style.backgroundColor = "#ef4444";

      setTimeout(() => {
        progressFill.style.backgroundColor = "#4ade80";
      }, 3000);
    } finally {
      this.isLoading = false;
      generateBtn.disabled = false;
      randomBtn.disabled = false;
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

// Initialize demo
new ModelDemo();
