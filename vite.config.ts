import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  worker: {
    format: "es",
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
