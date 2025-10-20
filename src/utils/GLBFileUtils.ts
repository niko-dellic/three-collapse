import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

/**
 * Shared GLB file loading and saving utilities
 */

export interface LoadedGLBFile {
  file: File;
  filename: string;
  meshes: THREE.Mesh[];
}

/**
 * Pick a directory using the File System Access API
 * @returns FileSystemDirectoryHandle or null if not supported/cancelled
 */
export async function pickDirectory(): Promise<any | null> {
  // Check if File System Access API is supported
  if (!("showDirectoryPicker" in window)) {
    alert(
      "Directory picking not supported in this browser. Please use file upload instead."
    );
    return null;
  }

  try {
    // @ts-ignore - File System Access API
    const directoryHandle = await window.showDirectoryPicker({
      mode: "readwrite", // Request write permission for later export
    });

    console.log(`Selected directory: ${directoryHandle.name}`);
    return directoryHandle;
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      console.error("Error picking directory:", error);
      alert("Error accessing directory. Check console for details.");
    }
    return null;
  }
}

/**
 * Load GLB files from a directory handle
 * @param directoryHandle FileSystemDirectoryHandle
 * @returns Array of files and their file handles
 */
export async function loadGLBFilesFromDirectory(
  directoryHandle: any
): Promise<{ files: File[]; fileHandles: Map<string, any> }> {
  const files: File[] = [];
  const fileHandles = new Map<string, any>();

  // @ts-ignore
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".glb")) {
      const fileHandle = await entry;
      const file = await fileHandle.getFile();
      files.push(file);

      // Store file handle for later export
      const filename = file.name.replace(/\.glb$/i, "");
      fileHandles.set(filename, fileHandle);
    }
  }

  console.log(`Found ${files.length} GLB files in directory`);
  return { files, fileHandles };
}

/**
 * Parse GLB files and extract meshes with userData
 * @param files Array of GLB files
 * @returns Array of loaded GLB data
 */
export async function parseGLBFiles(files: File[]): Promise<LoadedGLBFile[]> {
  const glbLoader = new GLTFLoader();
  const loadedFiles: LoadedGLBFile[] = [];

  for (const file of files) {
    const filename = file.name.replace(/\.glb$/i, "");
    const arrayBuffer = await file.arrayBuffer();

    await new Promise<void>((resolve, reject) => {
      glbLoader.parse(
        arrayBuffer,
        "",
        (gltf) => {
          // Traverse scene to find all mesh objects
          const meshes: THREE.Mesh[] = [];
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              meshes.push(child);
            }
          });

          console.log(`Found ${meshes.length} mesh(es) in ${filename}.glb`);
          loadedFiles.push({ file, filename, meshes });
          resolve();
        },
        (error) => reject(error)
      );
    });
  }

  return loadedFiles;
}

/**
 * Export a scene to GLB format
 * @param scene THREE.Scene to export
 * @returns ArrayBuffer of GLB data
 */
export async function exportSceneToGLB(
  scene: THREE.Scene
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result as ArrayBuffer),
      (error) => reject(error),
      { binary: true }
    );
  });
}

/**
 * Save GLB data to a file handle (directory mode)
 * @param fileHandle FileSystemFileHandle
 * @param arrayBuffer GLB data
 * @param filename Name of file for logging
 */
export async function saveGLBToFileHandle(
  fileHandle: any,
  arrayBuffer: ArrayBuffer,
  filename: string
): Promise<void> {
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(arrayBuffer);
  await writable.close();
  console.log(`✓ Saved: ${filename}.glb`);
}

/**
 * Download GLB data as a file
 * @param arrayBuffer GLB data
 * @param filename Name of file to download
 */
export async function downloadGLB(
  arrayBuffer: ArrayBuffer,
  filename: string
): Promise<void> {
  const blob = new Blob([arrayBuffer], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.glb`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`✓ Downloaded: ${filename}.glb`);

  // Small delay to avoid browser blocking multiple downloads
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Download JSON data as a file
 * @param json JSON string
 * @param filename Name of file to download
 */
export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
