import { beforeEach, describe, expect, it } from "vitest";

import {
  applyShellTheme,
  currentShellTheme,
  installShellThemeBridge,
  listShellThemes,
  setAvailableShellThemes
} from "@react-shell/theme";
import { themeCopy } from "@react-shell/theme-copy";

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
});
