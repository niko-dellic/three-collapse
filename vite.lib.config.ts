import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ThreeCollapse",
      formats: ["es", "cjs"],
      fileName: (format) => `three-collapse.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [
        "three",
        "three/examples/jsm/loaders/GLTFLoader.js",
        "three/examples/jsm/controls/OrbitControls.js",
      ],
      output: {
        globals: {
          three: "THREE",
        },
      },
    },
    outDir: "dist/lib",
    emptyOutDir: false,
    copyPublicDir: false,
  },
});
