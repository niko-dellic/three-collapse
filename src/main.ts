import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { voxelTileset } from "../examples/tiles/voxels/tileset";
import type { VoxelTile3DConfig } from "./wfc3d";

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

class VoxelDemo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private voxelGroup: THREE.Group;
  private worker: Worker | null = null;

  private width = 30;
  private height = 5;
  private depth = 30;
  private voxelSize = 1;

  private tiles: Map<string, VoxelTile3DConfig>;
  private currentSeed: number = Date.now();

  constructor() {
    // Create tile map
    this.tiles = new Map(voxelTileset.map((t: VoxelTile3DConfig) => [t.id, t]));

    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 10, 50);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Create voxel group
    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    // Center the voxel group
    this.voxelGroup.position.set(
      (-this.width * this.voxelSize) / 2,
      (-this.height * this.voxelSize) / 2,
      (-this.depth * this.voxelSize) / 2
    );

    // Setup UI
    this.setupUI();

    // Handle window resize
    window.addEventListener("resize", () => this.onWindowResize());

    // Start animation
    this.animate();
  }

  private setupUI(): void {
    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.style.position = "absolute";
    uiContainer.style.top = "10px";
    uiContainer.style.left = "10px";
    uiContainer.style.padding = "15px";
    uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    uiContainer.style.color = "white";
    uiContainer.style.fontFamily = "monospace";
    uiContainer.style.borderRadius = "5px";
    uiContainer.style.zIndex = "1000";
    document.body.appendChild(uiContainer);

    // Title
    const title = document.createElement("h2");
    title.textContent = "3D Wave Function Collapse";
    title.style.margin = "0 0 10px 0";
    uiContainer.appendChild(title);

    // Info
    const info = document.createElement("div");
    info.textContent = `Grid: ${this.width}×${this.height}×${this.depth}`;
    info.style.marginBottom = "10px";
    uiContainer.appendChild(info);

    // Seed input
    const seedContainer = document.createElement("div");
    seedContainer.style.marginBottom = "10px";

    const seedLabel = document.createElement("label");
    seedLabel.textContent = "Seed: ";
    seedContainer.appendChild(seedLabel);

    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = this.currentSeed.toString();
    seedInput.style.width = "100px";
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
    generateBtn.addEventListener("click", () => this.generate());
    uiContainer.appendChild(generateBtn);

    // Random seed button
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "Random Seed";
    randomBtn.style.padding = "10px 20px";
    randomBtn.style.cursor = "pointer";
    randomBtn.addEventListener("click", () => {
      this.currentSeed = Date.now();
      seedInput.value = this.currentSeed.toString();
    });
    uiContainer.appendChild(randomBtn);

    // Progress bar
    const progressContainer = document.createElement("div");
    progressContainer.style.marginTop = "10px";
    progressContainer.style.display = "none";

    const progressLabel = document.createElement("div");
    progressLabel.textContent = "Generating...";
    progressLabel.style.marginBottom = "5px";
    progressContainer.appendChild(progressLabel);

    const progressBar = document.createElement("div");
    progressBar.style.width = "200px";
    progressBar.style.height = "20px";
    progressBar.style.backgroundColor = "#333";
    progressBar.style.borderRadius = "3px";
    progressBar.style.overflow = "hidden";

    const progressFill = document.createElement("div");
    progressFill.style.width = "0%";
    progressFill.style.height = "100%";
    progressFill.style.backgroundColor = "#4CAF50";
    progressFill.style.transition = "width 0.3s";
    progressBar.appendChild(progressFill);

    progressContainer.appendChild(progressBar);
    uiContainer.appendChild(progressContainer);

    // Store references for later use
    (this as any).progressContainer = progressContainer;
    (this as any).progressFill = progressFill;
    (this as any).generateBtn = generateBtn;
  }

  private async generate(): Promise<void> {
    const progressContainer = (this as any).progressContainer as HTMLDivElement;
    const progressFill = (this as any).progressFill as HTMLDivElement;
    const generateBtn = (this as any).generateBtn as HTMLButtonElement;

    // Show progress
    progressContainer.style.display = "block";
    progressFill.style.width = "0%";
    generateBtn.disabled = true;

    // Clear existing voxels
    while (this.voxelGroup.children.length > 0) {
      const child = this.voxelGroup.children[0];
      this.voxelGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    try {
      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker(new URL("./wfc.worker.ts", import.meta.url), {
          type: "module",
        });
      }

      // Setup promise for worker completion
      const result = await new Promise<string[][][]>((resolve, reject) => {
        if (!this.worker) return reject(new Error("Worker not initialized"));

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const message = e.data;

          if (message.type === "progress") {
            progressFill.style.width = `${message.progress * 100}%`;
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
          tiles: voxelTileset,
          seed: this.currentSeed,
        });
      });

      // Render voxels
      this.renderVoxels(result);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressContainer.style.display = "none";
      }, 500);
    } catch (error) {
      console.error("Generation error:", error);
      alert(error instanceof Error ? error.message : "Generation failed");
      progressContainer.style.display = "none";
    } finally {
      generateBtn.disabled = false;
    }
  }

  private renderVoxels(data: string[][][]): void {
    const geometry = new THREE.BoxGeometry(
      this.voxelSize,
      this.voxelSize,
      this.voxelSize
    );
    const materials = new Map<string, THREE.MeshLambertMaterial>();

    // Create materials for each tile type
    for (const [id, tile] of this.tiles) {
      if (id === "air") continue; // Don't render air

      const material = new THREE.MeshLambertMaterial({
        color: tile.color,
      });
      materials.set(id, material);
    }

    // Create voxel mesh
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < this.depth; z++) {
          const tileId = data[x][y][z];

          if (!tileId || tileId === "air") continue;

          const material = materials.get(tileId);
          if (!material) continue;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(
            x * this.voxelSize + this.voxelSize / 2,
            y * this.voxelSize + this.voxelSize / 2,
            z * this.voxelSize + this.voxelSize / 2
          );

          this.voxelGroup.add(mesh);
        }
      }
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
new VoxelDemo();
