import { navigateTo } from "./navigation.js";

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
