import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { ModuleOptionsResponse } from "@frontend-generated/shared-runtime-validation.mts";
import { getModuleOptions } from "@frontend-core/api/client.mts";

import { AppShellLayout, resolveCurrentGameId } from "@react-shell/app-shell-layout";
import { setAvailableShellThemes } from "@react-shell/theme";

import { beforeEach, describe, expect, it, vi } from "vitest";

const moduleStyleMocks = vi.hoisted(() => ({
  syncModuleStyleAssets: vi.fn()
}));
const authMocks = vi.hoisted(() => ({
  state: {
    status: "unauthenticated",
    message: "Sign in to continue."
  },
  signIn: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@frontend-core/api/client.mts", () => ({
  getModuleOptions: vi.fn()
}));

vi.mock("@react-shell/module-style-assets", () => ({
  syncModuleStyleAssets: moduleStyleMocks.syncModuleStyleAssets
}));

vi.mock("@react-shell/auth", () => ({
  useAuth: () => ({
    state: authMocks.state,
    signIn: authMocks.signIn,
    signOut: authMocks.signOut
  })
}));

const getModuleOptionsMock = vi.mocked(getModuleOptions);

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function createModuleOptionsResponse(siteThemeIds: string[]): ModuleOptionsResponse {
  return {
    modules: [],
    enabledModules: [],
    gameModules: [],
    content: {
      siteThemeIds
    },
    gamePresets: [],
    uiSlots: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: []
  };
}

function renderLayout(path = "/react/profile") {
  return render(
    createElement(
      QueryClientProvider,
      { client: createQueryClient() },
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(AppShellLayout, null, createElement("div", null, "child"))
      )
    )
  );
}

describe("resolveCurrentGameId", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
    window.localStorage.clear();
    setAvailableShellThemes(["command", "midnight", "ember"]);
    authMocks.state = {
      status: "unauthenticated",
      message: "Sign in to continue."
    };
    authMocks.signIn.mockReset();
    authMocks.signOut.mockReset();
    getModuleOptionsMock.mockReset();
    moduleStyleMocks.syncModuleStyleAssets.mockClear();
  });

  it("returns the decoded path game id for valid route segments", () => {
    expect(resolveCurrentGameId("/react/game/test%20game")).toBe("test game");
  });

  it("falls back to the raw segment when the route contains malformed percent encoding", () => {
    expect(() => resolveCurrentGameId("/react/game/%E0%A4%A")).not.toThrow();
    expect(resolveCurrentGameId("/react/game/%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("reapplies the normalized theme after runtime theme ids change", async () => {
    document.documentElement.dataset.theme = "midnight";
    document.body.dataset.theme = "midnight";
    window.localStorage.setItem("netrisk.theme", "midnight");
    getModuleOptionsMock.mockResolvedValue(createModuleOptionsResponse(["ember"]));

    renderLayout();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("command");
    });
    expect(document.body.dataset.theme).toBe("command");
    expect(window.localStorage.getItem("netrisk.theme")).toBe("command");
  });

  it("preserves a saved module theme until runtime theme ids are available", async () => {
    window.localStorage.setItem("netrisk.theme", "aurora");
    getModuleOptionsMock.mockResolvedValue(createModuleOptionsResponse(["aurora", "ember"]));

    renderLayout();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("aurora");
    });
    expect(document.body.dataset.theme).toBe("aurora");
    expect(window.localStorage.getItem("netrisk.theme")).toBe("aurora");
  });

  it("reapplies an authenticated module theme preference after runtime theme ids load", async () => {
    document.documentElement.dataset.theme = "command";
    document.body.dataset.theme = "command";
    window.localStorage.setItem("netrisk.theme", "command");
    authMocks.state = {
      status: "authenticated",
      user: {
        id: "user-1",
        username: "Player",
        preferences: {
          theme: "aurora"
        }
      }
    };
    getModuleOptionsMock.mockResolvedValue(createModuleOptionsResponse(["aurora", "ember"]));

    renderLayout();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("aurora");
    });
    expect(document.body.dataset.theme).toBe("aurora");
    expect(window.localStorage.getItem("netrisk.theme")).toBe("aurora");
  });

  it("does not overwrite a saved module theme when module options fail to load", async () => {
    window.localStorage.setItem("netrisk.theme", "aurora");
    getModuleOptionsMock.mockRejectedValue(new Error("options unavailable"));

    renderLayout();

    await waitFor(() => {
      expect(getModuleOptionsMock).toHaveBeenCalledTimes(1);
    });
    expect(window.localStorage.getItem("netrisk.theme")).toBe("aurora");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.body.dataset.theme).toBeUndefined();
    expect(moduleStyleMocks.syncModuleStyleAssets).not.toHaveBeenCalled();
  });
});
