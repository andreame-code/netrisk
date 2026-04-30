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

function warTableReferenceGapCss(css: string): string {
  const marker = "/* War Table reference-gap pass";
  const start = css.indexOf(marker);

  if (start === -1) {
    return "";
  }

  const reducedMotionStart = css.indexOf("@media (prefers-reduced-motion", start);
  return css
    .slice(start, reducedMotionStart === -1 ? undefined : reducedMotionStart)
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function warTableReferenceGapSelectors(css: string): string[] {
  return Array.from(warTableReferenceGapCss(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap(
    (match) => {
      const selectorText = match[1].trim();

      if (!selectorText || selectorText.startsWith("@")) {
        return [];
      }

      return selectorText
        .split(",")
        .map((selector) => selector.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    }
  );
}

function ruleBodyForSelector(css: string, selector: string): string | null {
  const normalizedSelector = selector.trim().replace(/\s+/g, " ");

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1].split(",").map((entry) => entry.trim().replace(/\s+/g, " "));

    if (selectorList.includes(normalizedSelector)) {
      return match[2];
    }
  }

  return null;
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

  it("keeps War Table custom-background map territories colored by owner", () => {
    const css = readFileSync(themeTokensPath, "utf8");
    const territoryRuleBody = ruleBodyForSelector(
      css,
      'html[data-theme="war-table"] .map-board-surface:has(.map-board.has-custom-background) .territory-node'
    );

    expect(territoryRuleBody).not.toBeNull();
    expect(territoryRuleBody).toMatch(/background\s*:\s*var\(--owner-color/i);
    expect(territoryRuleBody).toMatch(/border-radius\s*:\s*999px/i);
    expect(territoryRuleBody).not.toMatch(/background\s*:\s*transparent/i);

    for (const stateSelector of [
      'html[data-theme="war-table"] .map-board-surface:has(.map-board.has-custom-background) .territory-node:hover',
      'html[data-theme="war-table"] .map-board-surface:has(.map-board.has-custom-background) .territory-node.is-source',
      'html[data-theme="war-table"] .map-board-surface:has(.map-board.has-custom-background) .territory-node.is-target',
      'html[data-theme="war-table"] .map-board-surface:has(.map-board.has-custom-background) .territory-node.is-reinforce'
    ]) {
      const stateRuleBody = ruleBodyForSelector(css, stateSelector);

      expect(stateRuleBody).not.toBeNull();
      expect(stateRuleBody).toMatch(/background\s*:\s*var\(--owner-color/i);
    }
  });

  it("keeps War Table visual refinements scoped to reusable shell surfaces", () => {
    const css = readFileSync(themeTokensPath, "utf8");
    const selectors = warTableReferenceGapSelectors(css);
    const unscopedSelectors = selectors.filter(
      (selector) => !selector.startsWith('html[data-theme="war-table"]')
    );

    expect(css).toContain("War Table reference-gap pass");
    expect(selectors.length).toBeGreaterThan(20);
    expect(unscopedSelectors).toEqual([]);
    expect(selectors).toContain('html[data-theme="war-table"] .session-browser');
    expect(selectors).toContain('html[data-theme="war-table"] .game-main-column');
    expect(selectors).toContain('html[data-theme="war-table"] .profile-shell');
    expect(
      selectors.some((selector) =>
        selector.startsWith('html[data-theme="war-table"] body[data-app-section="admin"]')
      )
    ).toBe(true);
    expect(css).not.toMatch(/ChatGPT Image|D:\/Andre|Downloads/i);
  });

  it("uses runtime theme metadata for labels", () => {
    setAvailableShellThemes([{ id: "aurora", name: "Aurora Signal" }]);

    expect(themeLabel("aurora")).toBe("Aurora Signal");
  });
});
