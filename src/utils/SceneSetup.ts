import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneConfig {
  backgroundColor?: number;
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

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
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
  scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

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

  return { scene, camera, renderer, controls };
}

/**
 * Adds lighting to the scene based on configuration
 */
export function addLighting(
  scene: THREE.Scene,
  config: LightConfig = {}
): void {
  const { ambient = {}, directional = {}, hemisphere } = config;

  // Ambient light
  if (ambient !== null) {
    const ambientLight = new THREE.AmbientLight(
      ambient.color ?? 0xffffff,
      ambient.intensity ?? 0.6
    );
    scene.add(ambientLight);
  }

  // Directional light
  if (directional !== null) {
    const directionalLight = new THREE.DirectionalLight(
      directional.color ?? 0xffffff,
      directional.intensity ?? 0.6
    );

    const pos = directional.position ?? { x: 10, y: 20, z: 10 };
    directionalLight.position.set(pos.x, pos.y, pos.z);

    if (directional.castShadow) {
      directionalLight.castShadow = true;
      const shadowCam = directional.shadowCamera ?? {};
      directionalLight.shadow.camera.left = shadowCam.left ?? -20;
      directionalLight.shadow.camera.right = shadowCam.right ?? 20;
      directionalLight.shadow.camera.top = shadowCam.top ?? 20;
      directionalLight.shadow.camera.bottom = shadowCam.bottom ?? -20;

      const shadowMapSize = directional.shadowMapSize ?? 2048;
      directionalLight.shadow.mapSize.width = shadowMapSize;
      directionalLight.shadow.mapSize.height = shadowMapSize;
    }

    scene.add(directionalLight);
  }

  // Hemisphere light
  if (hemisphere) {
    const hemiLight = new THREE.HemisphereLight(
      hemisphere.skyColor ?? 0x87ceeb,
      hemisphere.groundColor ?? 0x8b4513,
      hemisphere.intensity ?? 0.3
    );
    scene.add(hemiLight);
  }
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
  controls: OrbitControls
): () => void {
  const animate = (): void => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  return animate;
}
