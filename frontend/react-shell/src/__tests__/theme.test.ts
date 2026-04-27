import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it } from "vitest";

import {
  applyShellTheme,
  currentShellTheme,
  installShellThemeBridge,
  listShellThemes,
  setAvailableShellThemes,
  themeLabel
} from "@react-shell/theme";
import { themeCopy } from "@react-shell/theme-copy";

const themeTokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "theme-tokens.css"
);

function exactWarTableTopNavModuleSlotRuleBodies(css: string): string[] {
  const ruleBodies: string[] = [];

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1]
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);

    if (selectorList.includes('html[data-theme="war-table"] .top-nav-module-slots')) {
      ruleBodies.push(match[2]);
    }
  }

  return ruleBodies;
}

describe("theme runtime bridge", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
    window.localStorage.clear();
    setAvailableShellThemes(["command", "midnight", "ember", "war-table"]);
    installShellThemeBridge();
  });

  it("tracks runtime theme ids and keeps the current theme normalized", () => {
    applyShellTheme("midnight");

    const availableThemes = setAvailableShellThemes(["ember", "aurora"]);

    expect(availableThemes).toEqual(["command", "ember", "aurora"]);
    expect(currentShellTheme()).toBe("command");
    expect(listShellThemes()).toEqual([{ id: "command" }, { id: "ember" }, { id: "aurora" }]);
    expect(window.netriskTheme?.getThemes()).toEqual(["command", "ember", "aurora"]);
  });

  it("uses War Table copy overrides without changing other theme copy", () => {
    expect(themeCopy("war-table", "lobby.heading", "lobby.heading")).toBe("Sala campagna");
    expect(themeCopy("command", "lobby.heading", "lobby.heading")).toBe("Lobby di Comando");
  });

  it("keeps War Table top-nav module slots visible for module links", () => {
    const css = readFileSync(themeTokensPath, "utf8");
    const slotRuleBodies = exactWarTableTopNavModuleSlotRuleBodies(css);

    expect(slotRuleBodies.length).toBeGreaterThan(0);
    expect(slotRuleBodies.join("\n")).not.toMatch(/\bdisplay\s*:\s*none\b/i);
  });

  it("uses runtime theme metadata for labels", () => {
    setAvailableShellThemes([{ id: "aurora", name: "Aurora Signal" }]);

    expect(themeLabel("aurora")).toBe("Aurora Signal");
  });
});
