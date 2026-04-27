import { beforeEach, describe, expect, it } from "vitest";

import {
  applyShellTheme,
  currentShellTheme,
  installShellThemeBridge,
  listShellThemes,
  setAvailableShellThemes,
  themeLabel
} from "@react-shell/theme";

describe("theme runtime bridge", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
    window.localStorage.clear();
    setAvailableShellThemes(["command", "midnight", "ember"]);
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

  it("uses runtime theme metadata for labels", () => {
    setAvailableShellThemes([{ id: "aurora", name: "Aurora Signal" }]);

    expect(themeLabel("aurora")).toBe("Aurora Signal");
  });
});
