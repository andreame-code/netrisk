import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const reactShellRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(reactShellRoot, "..", "..");

export default defineConfig({
  root: reactShellRoot,
  plugins: [react()],
  define: {
    __NETRISK_APP_ENVIRONMENT__: JSON.stringify("preview"),
    __NETRISK_APP_RELEASE__: JSON.stringify("vitest-build")
  },
  resolve: {
    alias: {
      "@react-shell": path.resolve(reactShellRoot, "src"),
      "@frontend-core": path.resolve(projectRoot, "frontend", "src", "core"),
      "@frontend-generated": path.resolve(projectRoot, "frontend", "src", "generated"),
      "@frontend-i18n": path.resolve(projectRoot, "frontend", "src", "i18n.mts"),
      "@shared": path.resolve(projectRoot, "shared")
    }
  },
  test: {
    environment: "jsdom",
    testTimeout: 10_000,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/react/"
      }
    }
  }
});
