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
    cameraPosition?: {
        x: number;
        y: number;
        z: number;
    };
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
        position?: {
            x: number;
            y: number;
            z: number;
        };
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
    lights: {
        ambientLight: THREE.AmbientLight;
        directionalLight: THREE.DirectionalLight;
        hemiLight: THREE.HemisphereLight;
    };
}
/**
 * Creates and configures a basic Three.js scene with camera, renderer, and controls
 */
export declare function createScene(config?: SceneConfig): SceneSetupResult;
/**
 * Adds lighting to the scene based on configuration
 */
export declare function addLighting(scene: THREE.Scene): {
    ambientLight: THREE.AmbientLight;
    directionalLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
};
/**
 * Creates a window resize handler for the camera and renderer
 */
export declare function createResizeHandler(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): () => void;
/**
 * Creates an animation loop that updates controls and renders the scene
 */
export declare function createAnimationLoop(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls): () => void;
export declare function updateDirectionalLight(scene: THREE.Scene, directionalLight: THREE.DirectionalLight): void;
//# sourceMappingURL=SceneSetup.d.ts.map