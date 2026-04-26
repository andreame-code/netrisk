import { beforeEach, describe, expect, it, vi } from "vitest";

const reactDomMocks = vi.hoisted(() => {
  const render = vi.fn();
  const createRoot = vi.fn(() => ({ render }));

  return {
    createRoot,
    render
  };
});

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: reactDomMocks.createRoot
  }
}));

vi.mock("@react-shell/App", () => ({
  App: () => null
}));

vi.mock("@react-shell/observability", () => ({
  createReactShellRootOptions: () => ({}),
  initReactShellObservability: vi.fn()
}));

describe("React shell bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    reactDomMocks.createRoot.mockClear();
    reactDomMocks.render.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
    document.documentElement.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  it("does not overwrite a saved module theme before runtime theme ids load", async () => {
    window.localStorage.setItem("netrisk.theme", "aurora");

    await import("@react-shell/main");

    expect(window.localStorage.getItem("netrisk.theme")).toBe("aurora");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(reactDomMocks.createRoot).toHaveBeenCalledTimes(1);
    expect(reactDomMocks.render).toHaveBeenCalledTimes(1);
  });

  it("applies a saved registered theme before rendering routes outside the app layout", async () => {
    window.localStorage.setItem("netrisk.theme", "midnight");

    await import("@react-shell/main");

    expect(window.localStorage.getItem("netrisk.theme")).toBe("midnight");
    expect(document.documentElement.dataset.theme).toBe("midnight");
    expect(document.body.dataset.theme).toBe("midnight");
    expect(reactDomMocks.createRoot).toHaveBeenCalledTimes(1);
    expect(reactDomMocks.render).toHaveBeenCalledTimes(1);
  });
});
