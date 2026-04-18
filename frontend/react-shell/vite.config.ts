import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const reactShellRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(reactShellRoot, "..", "..");
const backendTarget = process.env.VITE_BACKEND_TARGET || "http://127.0.0.1:3000";

export default defineConfig({
  root: reactShellRoot,
  base: "/react/",
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      "@react-shell": path.resolve(reactShellRoot, "src"),
      "@frontend-core": path.resolve(projectRoot, "frontend", "src", "core"),
      "@frontend-generated": path.resolve(projectRoot, "frontend", "src", "generated"),
      "@frontend-i18n": path.resolve(projectRoot, "frontend", "src", "i18n.mts"),
      "@shared": path.resolve(projectRoot, "shared")
    }
  },
  server: {
    fs: {
      allow: [projectRoot]
    },
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: path.resolve(projectRoot, "public", "react"),
    emptyOutDir: true
  }
});
