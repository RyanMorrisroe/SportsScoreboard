import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [vue(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 8000,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});