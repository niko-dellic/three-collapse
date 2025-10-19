import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneConfig {
  backgroundColor?: number;
  fog?: boolean;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
  cameraFov?: number;
  cameraNear?: number;
  cameraFar?: number;
  cameraPosition?: { x: number; y: number; z: number };
  enableShadows?: boolean;
  enableDamping?: boolean;
  dampingFactor?: number;
  maxPolarAngle?: number;
  gridLights?: {
    enabled: boolean;
    width: number;
    height: number;
    depth: number;
    cellSize: number;
    colors?: number[];
    intensity?: number;
    distance?: number;
    decay?: number;
    showHelpers?: boolean;
  };
}

export interface LightConfig {
  ambient?: {
    color?: number;
    intensity?: number;
  };
  directional?: {
    color?: number;
    intensity?: number;
    position?: { x: number; y: number; z: number };
    castShadow?: boolean;
    shadowCamera?: {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    };
    shadowMapSize?: number;
  };
  hemisphere?: {
    skyColor?: number;
    groundColor?: number;
    intensity?: number;
  };
}

export interface GridLightConfig {
  colors: number[];
  intensity?: number;
  distance?: number;
  decay?: number;
  showHelpers?: boolean;
}

export interface AnimatedLight {
  light: THREE.PointLight;
  helper?: THREE.PointLightHelper;
  currentCell: { x: number; y: number; z: number };
  targetCell: { x: number; y: number; z: number };
  progress: number; // 0 to 1 for lerp
  speed: number; // cells per second
  axisOrder: string; // 'xyz', 'xzy', 'yxz', 'yzx', 'zxy', 'zyx'
  direction: number; // 1 or -1
}

export interface GridLightSystem {
  lights: AnimatedLight[];
  gridBounds: {
    width: number;
    height: number;
    depth: number;
    cellSize: number;
  };
  update: (deltaTime: number) => void;
  updateGrid: (
    width: number,
    height: number,
    depth: number,
    cellSize: number
  ) => void;
  dispose: () => void;
}

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  lights: {
    ambientLight: THREE.AmbientLight;
    directionalLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
  };
  gridLights?: GridLightSystem;
}

/**
 * Creates and configures a basic Three.js scene with camera, renderer, and controls
 */
export function createScene(config: SceneConfig = {}): SceneSetupResult {
  const {
    backgroundColor = 0x000000,
    fogColor = 0x000000,
    fogNear = 10,
    fogFar = 50,
    cameraFov = 60,
    cameraNear = 0.1,
    cameraFar = 1000,
    cameraPosition = { x: 15, y: 15, z: 15 },
    enableShadows = false,
    enableDamping = true,
    dampingFactor = 0.05,
    maxPolarAngle,
  } = config;

  // Setup scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);

  if (config.fog) scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

  // Setup camera
  const camera = new THREE.PerspectiveCamera(
    cameraFov,
    window.innerWidth / window.innerHeight,
    cameraNear,
    cameraFar
  );
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  camera.lookAt(0, 0, 0);

  // Setup renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  if (enableShadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  document.body.appendChild(renderer.domElement);

  // Setup controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = enableDamping;
  controls.dampingFactor = dampingFactor;

  if (maxPolarAngle !== undefined) {
    controls.maxPolarAngle = maxPolarAngle;
  }

  // Add lighting
  const lights = addLighting(scene);

  // Add grid lights if configured
  let gridLights: GridLightSystem | undefined;
  if (config.gridLights?.enabled) {
    gridLights = createGridLights(
      scene,
      {
        width: config.gridLights.width,
        height: config.gridLights.height,
        depth: config.gridLights.depth,
        cellSize: config.gridLights.cellSize,
      },
      {
        colors: config.gridLights.colors || [0xff7f00, 0x00ff7f, 0x7f00ff],
        intensity: config.gridLights.intensity,
        distance: config.gridLights.distance,
        decay: config.gridLights.decay,
        showHelpers: config.gridLights.showHelpers,
      }
    );
  }

  // Handle window resize
  const resizeHandler = createResizeHandler(camera, renderer);
  window.addEventListener("resize", resizeHandler);

  // Start animation
  const animate = createAnimationLoop(
    renderer,
    scene,
    camera,
    controls,
    gridLights
  );
  animate();

  return { scene, camera, renderer, controls, lights, gridLights };
}

/**
 * Adds lighting to the scene based on configuration
 */
export function addLighting(scene: THREE.Scene): {
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
} {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);

  directionalLight.position.set(20, 30, 20);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;

  const shadowMapSize = 2048;
  directionalLight.shadow.mapSize.width = shadowMapSize;
  directionalLight.shadow.mapSize.height = shadowMapSize;
  scene.add(directionalLight);

  const directionalLightHelper = new THREE.DirectionalLightHelper(
    directionalLight,
    1
  );
  scene.add(directionalLightHelper);

  // Hemisphere light
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.3);
  scene.add(hemiLight);

  return {
    ambientLight: ambientLight,
    directionalLight: directionalLight,
    hemiLight: hemiLight,
  };
}

/**
 * Creates animated point lights that move through grid cells
 */
export function createGridLights(
  scene: THREE.Scene,
  gridBounds: {
    width: number;
    height: number;
    depth: number;
    cellSize: number;
  },
  config: GridLightConfig = { colors: [0xff7f00, 0x00ff7f, 0x7f00ff] }
): GridLightSystem {
  const {
    colors,
    intensity = 3,
    distance = 15,
    decay = 1.5,
    showHelpers = false,
  } = config;

  // Maximum 7 animated lights that traverse the entire grid
  const totalCells = gridBounds.width * gridBounds.height * gridBounds.depth;
  const numLights = Math.min(10, Math.max(3, totalCells));

  // All possible axis orders for traversal
  const axisOrders = ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"];

  const animatedLights: AnimatedLight[] = [];

  // Create animated lights
  for (let i = 0; i < numLights; i++) {
    const color = colors[i % colors.length];
    const light = new THREE.PointLight(color, intensity, distance, decay);

    // Explicitly disable shadows for performance
    light.castShadow = false;

    // Random initial cell position
    const randomCell = {
      x: Math.floor(Math.random() * gridBounds.width),
      y: Math.floor(Math.random() * gridBounds.height),
      z: Math.floor(Math.random() * gridBounds.depth),
    };

    // Set initial world position
    const worldPos = cellToWorldPosition(randomCell, gridBounds);
    light.position.set(worldPos.x, worldPos.y, worldPos.z);

    scene.add(light);

    // Create helper if enabled
    let helper: THREE.PointLightHelper | undefined;
    if (showHelpers) {
      helper = new THREE.PointLightHelper(light, 0.5);
      scene.add(helper);
    }

    // Random axis order and direction
    const axisOrder = axisOrders[Math.floor(Math.random() * axisOrders.length)];
    const direction = Math.random() < 0.5 ? 1 : -1;

    animatedLights.push({
      light,
      helper,
      currentCell: { ...randomCell },
      targetCell: { ...randomCell },
      progress: 0,
      speed: 0.4 + Math.random() * 0.2, // 0.4-0.6 cells per second (80% slower)
      axisOrder,
      direction,
    });
  }

  // Get next cell based on axis order and direction
  const getNextCell = (
    cell: { x: number; y: number; z: number },
    axisOrder: string,
    direction: number,
    bounds: { width: number; height: number; depth: number }
  ): { cell: { x: number; y: number; z: number }; newDirection: number } => {
    const nextCell = { ...cell };
    let newDirection = direction;

    // Increment through axes based on order
    for (let i = 0; i < axisOrder.length; i++) {
      const axis = axisOrder[i];
      const maxVal =
        axis === "x"
          ? bounds.width
          : axis === "y"
          ? bounds.height
          : bounds.depth;

      if (axis === "x") {
        nextCell.x += direction;
        if (nextCell.x >= maxVal || nextCell.x < 0) {
          // Ping-pong: reverse direction
          newDirection *= -1;
          nextCell.x = Math.max(
            0,
            Math.min(maxVal - 1, nextCell.x - direction * 2)
          );
        } else {
          break; // Successfully incremented, stop
        }
      } else if (axis === "y") {
        nextCell.y += direction;
        if (nextCell.y >= maxVal || nextCell.y < 0) {
          newDirection *= -1;
          nextCell.y = Math.max(
            0,
            Math.min(maxVal - 1, nextCell.y - direction * 2)
          );
        } else {
          break;
        }
      } else if (axis === "z") {
        nextCell.z += direction;
        if (nextCell.z >= maxVal || nextCell.z < 0) {
          newDirection *= -1;
          nextCell.z = Math.max(
            0,
            Math.min(maxVal - 1, nextCell.z - direction * 2)
          );
        } else {
          break;
        }
      }
    }

    return { cell: nextCell, newDirection };
  };

  // Update function for animation loop
  const update = (deltaTime: number): void => {
    for (const animLight of animatedLights) {
      // If just starting or reached target, get next cell
      if (animLight.progress >= 1) {
        animLight.currentCell = { ...animLight.targetCell };
        const { cell, newDirection } = getNextCell(
          animLight.currentCell,
          animLight.axisOrder,
          animLight.direction,
          gridBounds
        );
        animLight.targetCell = cell;
        animLight.direction = newDirection;
        animLight.progress = 0;
      }

      // Update progress
      animLight.progress += animLight.speed * deltaTime;
      animLight.progress = Math.min(1, animLight.progress);

      // Lerp position
      const currentWorldPos = cellToWorldPosition(
        animLight.currentCell,
        gridBounds
      );
      const targetWorldPos = cellToWorldPosition(
        animLight.targetCell,
        gridBounds
      );

      animLight.light.position.x = THREE.MathUtils.lerp(
        currentWorldPos.x,
        targetWorldPos.x,
        animLight.progress
      );
      animLight.light.position.y = THREE.MathUtils.lerp(
        currentWorldPos.y,
        targetWorldPos.y,
        animLight.progress
      );
      animLight.light.position.z = THREE.MathUtils.lerp(
        currentWorldPos.z,
        targetWorldPos.z,
        animLight.progress
      );

      // Update helper if it exists (only when showing helpers for debugging)
      // Note: Helper updates are expensive, only enable for debugging
      if (animLight.helper && showHelpers) {
        animLight.helper.update();
      }
    }
  };

  // Update grid bounds and regenerate lights
  const updateGrid = (
    width: number,
    height: number,
    depth: number,
    cellSize: number
  ): void => {
    // Update bounds
    gridBounds.width = width;
    gridBounds.height = height;
    gridBounds.depth = depth;
    gridBounds.cellSize = cellSize;

    // Calculate new number of lights (max 7)
    const totalCells = width * height * depth;
    const newNumLights = Math.min(7, Math.max(3, totalCells));

    // Update lights count
    if (newNumLights > animatedLights.length) {
      // Add more lights
      const toAdd = newNumLights - animatedLights.length;
      for (let i = 0; i < toAdd; i++) {
        const color = colors[(animatedLights.length + i) % colors.length];
        const light = new THREE.PointLight(color, intensity, distance, decay);
        light.castShadow = false;

        const randomCell = {
          x: Math.floor(Math.random() * width),
          y: Math.floor(Math.random() * height),
          z: Math.floor(Math.random() * depth),
        };

        const worldPos = cellToWorldPosition(randomCell, gridBounds);
        light.position.set(worldPos.x, worldPos.y, worldPos.z);
        scene.add(light);

        let helper: THREE.PointLightHelper | undefined;
        if (showHelpers) {
          helper = new THREE.PointLightHelper(light, 0.5);
          scene.add(helper);
        }

        const axisOrder =
          axisOrders[Math.floor(Math.random() * axisOrders.length)];
        const direction = Math.random() < 0.5 ? 1 : -1;

        animatedLights.push({
          light,
          helper,
          currentCell: { ...randomCell },
          targetCell: { ...randomCell },
          progress: 0,
          speed: 0.4 + Math.random() * 0.2,
          axisOrder,
          direction,
        });
      }
    } else if (newNumLights < animatedLights.length) {
      // Remove excess lights
      const toRemove = animatedLights.length - newNumLights;
      for (let i = 0; i < toRemove; i++) {
        const animLight = animatedLights.pop();
        if (animLight) {
          scene.remove(animLight.light);
          if (animLight.helper) scene.remove(animLight.helper);
        }
      }
    }

    // Redistribute all lights to new random positions in the grid
    for (const animLight of animatedLights) {
      const randomCell = {
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * height),
        z: Math.floor(Math.random() * depth),
      };

      animLight.currentCell = randomCell;
      animLight.targetCell = { ...randomCell };
      animLight.progress = 0;

      // Randomize traversal pattern
      animLight.axisOrder =
        axisOrders[Math.floor(Math.random() * axisOrders.length)];
      animLight.direction = Math.random() < 0.5 ? 1 : -1;

      // Update position immediately
      const worldPos = cellToWorldPosition(randomCell, gridBounds);
      animLight.light.position.set(worldPos.x, worldPos.y, worldPos.z);
    }
  };

  // Dispose function
  const dispose = (): void => {
    for (const animLight of animatedLights) {
      scene.remove(animLight.light);
      if (animLight.helper) scene.remove(animLight.helper);
    }
    animatedLights.length = 0;
  };

  return {
    lights: animatedLights,
    gridBounds,
    update,
    updateGrid,
    dispose,
  };
}

/**
 * Convert cell coordinates to world position
 */
function cellToWorldPosition(
  cell: { x: number; y: number; z: number },
  gridBounds: { width: number; height: number; depth: number; cellSize: number }
): { x: number; y: number; z: number } {
  // Center the grid at origin
  const offsetX = (-gridBounds.width * gridBounds.cellSize) / 2;
  const offsetY = (-gridBounds.height * gridBounds.cellSize) / 2;
  const offsetZ = (-gridBounds.depth * gridBounds.cellSize) / 2;

  return {
    x: cell.x * gridBounds.cellSize + gridBounds.cellSize / 2 + offsetX,
    y: cell.y * gridBounds.cellSize + gridBounds.cellSize / 2 + offsetY,
    z: cell.z * gridBounds.cellSize + gridBounds.cellSize / 2 + offsetZ,
  };
}

/**
 * Creates a window resize handler for the camera and renderer
 */
export function createResizeHandler(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
): () => void {
  return () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
}

/**
 * Creates an animation loop that updates controls and renders the scene
 */
export function createAnimationLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  gridLights?: GridLightSystem
): () => void {
  let lastTime = performance.now();

  const animate = (): void => {
    requestAnimationFrame(animate);

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    controls.update();

    // Update grid lights if present
    if (gridLights) {
      gridLights.update(deltaTime);
    }

    renderer.render(scene, camera);
  };
  return animate;
}

export function updateDirectionalLight(
  scene: THREE.Scene,
  directionalLight: THREE.DirectionalLight
): void {
  const box = new THREE.Box3().setFromObject(scene);
  directionalLight.position.set(box.max.x, box.max.y, box.max.z);
}
