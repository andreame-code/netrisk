import { navigateTo, goHome, exitGame } from "../src/navigation.js";

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

  test("goHome navigates to index.html", () => {
    const win = { location: { assign: jest.fn() } };
    goHome(win);
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });

  test("exitGame confirms and navigates home", () => {
    const win = {
      confirm: jest.fn(() => true),
      location: { assign: jest.fn() },
    };
    exitGame(win);
    expect(win.confirm).toHaveBeenCalled();
    expect(win.location.assign).toHaveBeenCalledWith("index.html");
  });

  test("exitGame aborts when cancelled", () => {
    const win = {
      confirm: jest.fn(() => false),
      location: { assign: jest.fn() },
    };
    exitGame(win);
    expect(win.location.assign).not.toHaveBeenCalled();
  });
});
