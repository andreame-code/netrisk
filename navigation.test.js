import { navigateTo, goHome, exitGame } from "./navigation.js";

describe("navigateTo", () => {
  test("uses history.pushState and location.assign when available", () => {
    const win = {
      location: { assign: jest.fn() },
      history: { pushState: jest.fn() },
    };
    navigateTo("/somewhere", win);
    expect(win.history.pushState).toHaveBeenCalledWith({}, "", "/somewhere");
    expect(win.location.assign).toHaveBeenCalledWith("/somewhere");
  });

  test("falls back to setting location.href", () => {
    const win = { location: { href: "" } };
    navigateTo("/other", win);
    expect(win.location.href).toBe("/other");
  });
});

describe("goHome", () => {
  test("navigates to index.html", () => {
    const win = {
      location: { assign: jest.fn() },
      history: { pushState: jest.fn() },
    };
    goHome(win);
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });
});

describe("exitGame", () => {
  test("navigates when confirmed", () => {
    const win = {
      confirm: jest.fn(() => true),
      location: { assign: jest.fn() },
      history: { pushState: jest.fn() },
    };
    exitGame(win);
    expect(win.confirm).toHaveBeenCalled();
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });

  test("does not navigate when cancelled", () => {
    const win = {
      confirm: jest.fn(() => false),
      location: { assign: jest.fn() },
      history: { pushState: jest.fn() },
    };
    exitGame(win);
    expect(win.location.assign).not.toHaveBeenCalled();
  });
});
