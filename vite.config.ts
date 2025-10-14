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
      },
    },
  },
});
