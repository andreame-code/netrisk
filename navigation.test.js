import { navigateTo, goHome, exitGame } from "./navigation.js";

describe("navigateTo", () => {
  test("uses location.assign when available", () => {
    const win = { location: { assign: jest.fn() } };
    navigateTo("/somewhere", win);
    expect(win.location.assign).toHaveBeenCalledWith("/somewhere");
  });

  test("falls back to setting location.href", () => {
    const win = { location: { href: "" } };
    navigateTo("/other", win);
    expect(win.location.href).toBe("/other");
  });
});

describe("helpers", () => {
  test("goHome navigates to index", () => {
    const win = { location: { assign: jest.fn() } };
    goHome(win);
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });

  test("exitGame navigates to index", () => {
    const win = { location: { assign: jest.fn() } };
    exitGame(win);
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });
});
