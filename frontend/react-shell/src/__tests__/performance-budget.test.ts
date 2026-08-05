import {
  analyzeReactShellBundle,
  performanceBudgetErrors,
  type PerformanceBundleChunk,
  type PerformanceBundleOutput
} from "../../performance-budget";

import { describe, expect, it } from "vitest";

function chunk(
  fileName: string,
  options: Partial<PerformanceBundleChunk> = {}
): PerformanceBundleChunk {
  return {
    type: "chunk",
    fileName,
    code: fileName,
    facadeModuleId: null,
    imports: [],
    isEntry: false,
    modules: {},
    ...options
  };
}

describe("React shell performance budget", () => {
  it("measures the static JS and CSS closure for landing and lobby", () => {
    const outputs: PerformanceBundleOutput[] = [
      chunk("assets/index.js", {
        isEntry: true,
        imports: ["assets/vendor.js"],
        modules: { "/repo/src/main.tsx": { renderedLength: 20 } },
        viteMetadata: { importedCss: new Set(["assets/base.css"]) }
      }),
      chunk("assets/vendor.js"),
      chunk("assets/landing.js", {
        facadeModuleId: "/repo/frontend/react-shell/src/landing-app.tsx",
        viteMetadata: { importedCss: new Set(["assets/landing.css"]) }
      }),
      chunk("assets/app.js", {
        facadeModuleId: "/repo/frontend/react-shell/src/App.tsx",
        imports: ["assets/vendor.js"],
        viteMetadata: { importedCss: new Set(["assets/shell.css"]) }
      }),
      chunk("assets/lobby.js", {
        facadeModuleId: "/repo/frontend/react-shell/src/lobby-route.tsx",
        imports: ["assets/query.js"]
      }),
      chunk("assets/query.js"),
      { type: "asset", fileName: "assets/base.css", source: "base" },
      { type: "asset", fileName: "assets/landing.css", source: "landing" },
      { type: "asset", fileName: "assets/shell.css", source: "shell" }
    ];

    const report = analyzeReactShellBundle(outputs, "/repo");
    const landing = report.routes.find((route) => route.route === "landing");
    const lobby = report.routes.find((route) => route.route === "lobby");

    expect(landing?.jsFiles).toEqual(["assets/index.js", "assets/landing.js", "assets/vendor.js"]);
    expect(landing?.cssFiles).toEqual(["assets/base.css", "assets/landing.css"]);
    expect(lobby?.jsFiles).toEqual([
      "assets/app.js",
      "assets/index.js",
      "assets/lobby.js",
      "assets/query.js",
      "assets/vendor.js"
    ]);
    expect(lobby?.cssFiles).toEqual(["assets/base.css", "assets/shell.css"]);
    expect(report.largestEntryModules[0]).toEqual({
      module: "src/main.tsx",
      renderedBytes: 20
    });
  });

  it("returns clear route-specific failures when gzip budgets are exceeded", () => {
    expect(
      performanceBudgetErrors({
        routes: [
          {
            route: "landing",
            js: { rawBytes: 200_000, gzipBytes: 155_001 },
            css: { rawBytes: 40_000, gzipBytes: 33_001 },
            jsFiles: [],
            cssFiles: []
          }
        ],
        largestEntryModules: []
      })
    ).toEqual([
      "landing initial JS is 155.00 kB gzip; budget is 155.00 kB.",
      "landing initial CSS is 33.00 kB gzip; budget is 33.00 kB."
    ]);
  });
});
