import { describe, expect, it } from "vitest";

import type { ModuleOptionsResponse } from "@frontend-generated/shared-runtime-validation.mts";
import { syncModuleStyleAssets } from "@react-shell/module-style-assets";

function createModuleOptionsResponse(): ModuleOptionsResponse {
  return {
    modules: [
      {
        id: "core.base",
        version: "1.0.0",
        displayName: "Core",
        description: "Core",
        kind: "hybrid",
        sourcePath: "modules/core.base/module.json",
        status: "enabled",
        enabled: true,
        compatible: true,
        capabilities: [],
        warnings: [],
        errors: [],
        clientManifest: {
          ui: {
            stylesheets: ["/modules/core.base/assets/core.css", "./assets/extra.css"]
          }
        }
      },
      {
        id: "disabled.mod",
        version: "1.0.0",
        displayName: "Disabled",
        description: "Disabled",
        kind: "hybrid",
        sourcePath: "modules/disabled.mod/module.json",
        status: "validated",
        enabled: false,
        compatible: true,
        capabilities: [],
        warnings: [],
        errors: [],
        clientManifest: {
          ui: {
            stylesheets: ["/modules/disabled.mod/assets/disabled.css"]
          }
        }
      }
    ],
    enabledModules: [{ id: "core.base", version: "1.0.0" }],
    gameModules: [],
    content: {},
    gamePresets: [],
    uiSlots: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: []
  };
}

describe("syncModuleStyleAssets", () => {
  it("injects only enabled module stylesheets and removes stale links", () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="/stale.css" data-module-stylesheet="true">';

    syncModuleStyleAssets(createModuleOptionsResponse());

    const stylesheetHrefs = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[data-module-stylesheet="true"]')
    ).map((link) => link.getAttribute("href"));

    expect(stylesheetHrefs).toEqual([
      "/modules/core.base/assets/core.css",
      "/modules/core.base/assets/extra.css"
    ]);
  });

  it("does not interpolate href values into a selector lookup", () => {
    const moduleOptions = createModuleOptionsResponse();
    moduleOptions.modules[0].clientManifest.ui.stylesheets = ['./asset"quoted.css'];

    expect(() => syncModuleStyleAssets(moduleOptions)).not.toThrow();

    const stylesheetHrefs = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[data-module-stylesheet="true"]')
    ).map((link) => link.getAttribute("href"));

    expect(stylesheetHrefs).toEqual(['/modules/core.base/asset"quoted.css']);
  });
});
