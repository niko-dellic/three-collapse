import { defineConfig } from "vite";
import path, { resolve } from "path";

export default defineConfig({
  worker: {
    format: "es",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        models: resolve(__dirname, "models.html"),
        adjacencyBuilder: resolve(__dirname, "adjacency-builder.html"),
        connectorBuilder: resolve(__dirname, "connector-builder.html"),
        vrDemo: resolve(__dirname, "vr-demo.html"),
      },
    },
  },
});
