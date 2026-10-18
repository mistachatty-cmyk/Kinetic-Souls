import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/overlay"),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/page-overlay/main.ts"),
      name: "KineticSoulsPageBundle",
      formats: ["iife"],
      fileName: () => "kinetic-page.js",
    },
  },
});
