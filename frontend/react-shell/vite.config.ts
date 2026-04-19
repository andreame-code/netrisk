import path from "node:path";
import { fileURLToPath } from "node:url";

import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const reactShellRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(reactShellRoot, "..", "..");
const backendTarget = process.env.VITE_BACKEND_TARGET || "http://127.0.0.1:3000";
const reactShellOutDir = path.resolve(projectRoot, "public", "react");

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function resolveObservabilityEnvironment(): string {
  return (
    firstNonEmpty(
      process.env.NETRISK_APP_ENVIRONMENT,
      process.env.VERCEL_ENV,
      process.env.NODE_ENV
    ) || "development"
  );
}

function resolveObservabilityRelease(): string {
  return (
    firstNonEmpty(
      process.env.NETRISK_RELEASE,
      process.env.SENTRY_RELEASE,
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.GITHUB_SHA,
      process.env.COMMIT_SHA,
      process.env.npm_package_version
    ) || "local-dev"
  );
}

const reactShellEnvironment = resolveObservabilityEnvironment();
const reactShellRelease = resolveObservabilityRelease();
const reactShellSentryDsn = firstNonEmpty(process.env.VITE_SENTRY_DSN);
const reactShellObservabilityEnabled =
  Boolean(reactShellSentryDsn) &&
  (reactShellEnvironment === "preview" || reactShellEnvironment === "production");
const sentryOrg = firstNonEmpty(process.env.SENTRY_ORG);
const sentryProject = firstNonEmpty(process.env.SENTRY_PROJECT);
const sentryAuthToken = firstNonEmpty(process.env.SENTRY_AUTH_TOKEN);
const hasSentryUploadCredentials = Boolean(sentryOrg && sentryProject && sentryAuthToken);
const shouldValidateDeployEnv =
  Boolean(process.env.VERCEL) &&
  (reactShellEnvironment === "preview" || reactShellEnvironment === "production");

if (shouldValidateDeployEnv && reactShellObservabilityEnabled && !hasSentryUploadCredentials) {
  throw new Error(
    "React shell observability requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT when VITE_SENTRY_DSN is enabled for preview or production."
  );
}

const shouldUploadSentryArtifacts = reactShellObservabilityEnabled && hasSentryUploadCredentials;
const reactShellPlugins = [react()];
if (shouldUploadSentryArtifacts) {
  reactShellPlugins.push(
    sentryVitePlugin({
      authToken: sentryAuthToken || undefined,
      org: sentryOrg || undefined,
      project: sentryProject || undefined,
      release: {
        name: reactShellRelease
      },
      sourcemaps: {
        filesToDeleteAfterUpload: [path.join(reactShellOutDir, "**", "*.map")]
      },
      telemetry: false
    })
  );
}

export default defineConfig({
  root: reactShellRoot,
  base: "/react/",
  publicDir: false,
  define: {
    __NETRISK_APP_ENVIRONMENT__: JSON.stringify(reactShellEnvironment),
    __NETRISK_APP_RELEASE__: JSON.stringify(reactShellRelease)
  },
  plugins: reactShellPlugins,
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
    outDir: reactShellOutDir,
    emptyOutDir: true,
    sourcemap: shouldUploadSentryArtifacts
  }
});
