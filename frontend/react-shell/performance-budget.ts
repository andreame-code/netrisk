import path from "node:path";
import { gzipSync } from "node:zlib";

import type { Plugin } from "vite";

type RenderedModule = {
  renderedLength: number;
};

export type PerformanceBundleChunk = {
  type: "chunk";
  fileName: string;
  code: string;
  facadeModuleId: string | null;
  imports: string[];
  isEntry: boolean;
  modules: Record<string, RenderedModule>;
  viteMetadata?: {
    importedCss?: Set<string>;
  };
};

export type PerformanceBundleAsset = {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
};

export type PerformanceBundleOutput = PerformanceBundleChunk | PerformanceBundleAsset;

type TransferSize = {
  rawBytes: number;
  gzipBytes: number;
};

export type RoutePerformanceResult = {
  route: string;
  js: TransferSize;
  css: TransferSize;
  jsFiles: string[];
  cssFiles: string[];
};

export type ReactShellPerformanceReport = {
  routes: RoutePerformanceResult[];
  largestEntryModules: Array<{
    module: string;
    renderedBytes: number;
  }>;
};

export const reactShellPerformanceBudgets = Object.freeze({
  landing: Object.freeze({ jsGzipBytes: 155_000, cssGzipBytes: 33_000 }),
  lobby: Object.freeze({ jsGzipBytes: 180_000, cssGzipBytes: 55_000 })
});

const routeEntrySuffixes = Object.freeze({
  landing: ["/landing-app.tsx"],
  lobby: ["/App.tsx", "/lobby-route.tsx"]
});

function byteLength(source: string | Uint8Array): number {
  return typeof source === "string" ? Buffer.byteLength(source) : source.byteLength;
}

function gzipLength(source: string | Uint8Array): number {
  return gzipSync(source).byteLength;
}

function collectStaticChunkClosure(
  roots: PerformanceBundleChunk[],
  chunksByFile: Map<string, PerformanceBundleChunk>
): PerformanceBundleChunk[] {
  const collected = new Map<string, PerformanceBundleChunk>();

  function visit(chunk: PerformanceBundleChunk): void {
    if (collected.has(chunk.fileName)) {
      return;
    }

    collected.set(chunk.fileName, chunk);
    for (const importedFile of chunk.imports) {
      const importedChunk = chunksByFile.get(importedFile);
      if (importedChunk) {
        visit(importedChunk);
      }
    }
  }

  roots.forEach(visit);
  return [...collected.values()];
}

function transferSize(sources: Array<string | Uint8Array>): TransferSize {
  return {
    rawBytes: sources.reduce((total, source) => total + byteLength(source), 0),
    gzipBytes: sources.reduce((total, source) => total + gzipLength(source), 0)
  };
}

export function analyzeReactShellBundle(
  outputs: PerformanceBundleOutput[],
  projectRoot: string
): ReactShellPerformanceReport {
  const chunks = outputs.filter(
    (output): output is PerformanceBundleChunk => output.type === "chunk"
  );
  const assets = outputs.filter(
    (output): output is PerformanceBundleAsset => output.type === "asset"
  );
  const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const assetsByFile = new Map(assets.map((asset) => [asset.fileName, asset]));
  const entryChunk = chunks.find((chunk) => chunk.isEntry);

  if (!entryChunk) {
    throw new Error("React shell performance budget could not find the application entry chunk.");
  }

  const routes = Object.entries(routeEntrySuffixes).map(([route, moduleSuffixes]) => {
    const routeRootChunks = moduleSuffixes.map((moduleSuffix) => {
      const routeChunk = chunks.find((chunk) => chunk.facadeModuleId?.endsWith(moduleSuffix));
      if (!routeChunk) {
        throw new Error(
          `React shell performance budget could not find ${moduleSuffix} for the ${route} route.`
        );
      }
      return routeChunk;
    });

    const routeChunks = collectStaticChunkClosure([entryChunk, ...routeRootChunks], chunksByFile);
    const cssFiles = [
      ...new Set(
        routeChunks.flatMap((chunk) => [...(chunk.viteMetadata?.importedCss || new Set<string>())])
      )
    ].sort();
    const cssAssets = cssFiles.map((fileName) => {
      const asset = assetsByFile.get(fileName);
      if (!asset) {
        throw new Error(`React shell performance budget could not read CSS asset ${fileName}.`);
      }
      return asset.source;
    });

    return {
      route,
      js: transferSize(routeChunks.map((chunk) => chunk.code)),
      css: transferSize(cssAssets),
      jsFiles: routeChunks.map((chunk) => chunk.fileName).sort(),
      cssFiles
    };
  });

  const largestEntryModules = Object.entries(entryChunk.modules)
    .map(([moduleId, details]) => ({
      module: path.relative(projectRoot, moduleId).replaceAll(path.sep, "/"),
      renderedBytes: details.renderedLength
    }))
    .sort((left, right) => right.renderedBytes - left.renderedBytes)
    .slice(0, 10);

  return { routes, largestEntryModules };
}

function formatKilobytes(bytes: number): string {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

export function performanceBudgetErrors(report: ReactShellPerformanceReport): string[] {
  const errors: string[] = [];

  for (const route of report.routes) {
    const budget =
      reactShellPerformanceBudgets[route.route as keyof typeof reactShellPerformanceBudgets];
    if (!budget) {
      errors.push(`No initial-transfer budget is configured for ${route.route}.`);
      continue;
    }

    if (route.js.gzipBytes > budget.jsGzipBytes) {
      errors.push(
        `${route.route} initial JS is ${formatKilobytes(route.js.gzipBytes)} gzip; budget is ${formatKilobytes(budget.jsGzipBytes)}.`
      );
    }
    if (route.css.gzipBytes > budget.cssGzipBytes) {
      errors.push(
        `${route.route} initial CSS is ${formatKilobytes(route.css.gzipBytes)} gzip; budget is ${formatKilobytes(budget.cssGzipBytes)}.`
      );
    }
  }

  return errors;
}

export function reactShellPerformanceBudgetPlugin(projectRoot: string): Plugin {
  return {
    name: "netrisk-react-shell-performance-budget",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const report = analyzeReactShellBundle(
        Object.values(bundle) as PerformanceBundleOutput[],
        projectRoot
      );

      console.log("\nReact shell initial-transfer budget (raw / gzip):");
      for (const route of report.routes) {
        const budget =
          reactShellPerformanceBudgets[route.route as keyof typeof reactShellPerformanceBudgets];
        console.log(
          `- ${route.route}: JS ${formatKilobytes(route.js.rawBytes)} / ${formatKilobytes(route.js.gzipBytes)} (budget ${formatKilobytes(budget.jsGzipBytes)} gzip); CSS ${formatKilobytes(route.css.rawBytes)} / ${formatKilobytes(route.css.gzipBytes)} (budget ${formatKilobytes(budget.cssGzipBytes)} gzip)`
        );
      }

      console.log("Largest modules remaining in the entry chunk:");
      for (const module of report.largestEntryModules) {
        console.log(`- ${module.module}: ${formatKilobytes(module.renderedBytes)} rendered`);
      }

      const errors = performanceBudgetErrors(report);
      if (errors.length > 0) {
        throw new Error(`React shell initial-transfer budget exceeded:\n${errors.join("\n")}`);
      }
    }
  };
}
