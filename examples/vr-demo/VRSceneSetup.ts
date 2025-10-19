import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

export interface VRSceneConfig {
  backgroundColor?: number;
  enableShadows?: boolean;
  groundPlaneSize?: number;
  gridSize?: number;
  ambientIntensity?: number;
  directionalIntensity?: number;
}

export interface VRSceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  lights: {
    ambientLight: THREE.AmbientLight;
    directionalLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
  };
  ground: THREE.Mesh;
  gridHelper: THREE.GridHelper;
}

/**
 * Creates and configures a VR-compatible Three.js scene
 */
export function createVRScene(config: VRSceneConfig = {}): VRSceneSetupResult {
  const {
    backgroundColor = 0x1a1a2e,
    enableShadows = true,
    groundPlaneSize = 50,
    gridSize = 50,
    ambientIntensity = 0.5,
    directionalIntensity = 0.8,
  } = config;

  // Setup scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);

  // Setup camera (for non-VR fallback)
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 3); // Standard VR standing height

  // Setup renderer with WebXR
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  if (enableShadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  document.body.appendChild(renderer.domElement);

  // Add VR button
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  // Add lighting
  const lights = addVRLighting(scene, ambientIntensity, directionalIntensity);

  // Add ground plane
  const groundGeometry = new THREE.PlaneGeometry(
    groundPlaneSize,
    groundPlaneSize
  );
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(
    gridSize,
    gridSize,
    0x666666,
    0x444444
  );
  gridHelper.position.y = 0.01; // Slightly above ground to prevent z-fighting
  scene.add(gridHelper);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, lights, ground, gridHelper };
}

/**
 * Adds VR-optimized lighting to the scene
 */
function addVRLighting(
  scene: THREE.Scene,
  ambientIntensity: number,
  directionalIntensity: number
): {
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
} {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
  scene.add(ambientLight);

  // Directional light (main light)
  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    directionalIntensity
  );
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Hemisphere light for ambient fill
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
  scene.add(hemiLight);

  return {
    ambientLight,
    directionalLight,
    hemiLight,
  };
}

/**
 * Create reference markers for spatial awareness in VR
 */
export function createReferenceMarkers(scene: THREE.Scene): void {
  // Add axes helper at origin
  const axesHelper = new THREE.AxesHelper(2);
  axesHelper.position.y = 0.01;
  scene.add(axesHelper);

  // Add reference spheres at cardinal points
  const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });

  const positions = [
    [5, 0.5, 0],
    [-5, 0.5, 0],
    [0, 0.5, 5],
    [0, 0.5, -5],
  ];

  positions.forEach((pos) => {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(pos[0], pos[1], pos[2]);
    scene.add(sphere);
  });
}
