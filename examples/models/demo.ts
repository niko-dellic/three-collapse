import * as THREE from "three";
import { WFCGenerator } from "../../src/generators/WFCGenerator";
import { createScene } from "../SceneSetup";
import { mixedModelTileset } from "../tiles/models/tileset";

// Simple demo class for mixed models
class ModelsDemo {
  public scene!: THREE.Scene;
  public generator: WFCGenerator | null = null;
  public cellSize = 1;
  public width = 10;
  public height = 8;
  public depth = 10;

  async init(): Promise<void> {
    // Setup scene
    const { scene } = createScene({
      cameraPosition: { x: 15, y: 12, z: 15 },
      enableShadows: true,
      maxPolarAngle: Math.PI / 2,
    });
    this.scene = scene;

    // Create generator with initial dimensions
    this.generator = new WFCGenerator(mixedModelTileset, {
      workerCount: 4,
      maxRetries: 3,
      autoExpansion: false,
      seed: Date.now(),
      scene: this.scene,
      cellSize: this.cellSize,
      width: this.width,
      height: this.height,
      depth: this.depth,
      debug: true,
    });

    // Initial collapse
    await this.generator.generate();

    console.log("Models demo initialized!");
  }
}

// Initialize demo
(async () => {
  const demo = new ModelsDemo();
  await demo.init();
})();
