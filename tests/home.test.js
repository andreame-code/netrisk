jest.mock("../src/theme.js", () => ({ initThemeToggle: jest.fn() }));
jest.mock("../src/navigation.js", () => ({ navigateTo: jest.fn() }));
const mockAuthPort = {
  currentUser: jest.fn().mockResolvedValue({}),
};
jest.mock("../src/infra/supabase/auth.adapter.ts", () => ({
  createAuthAdapter: () => mockAuthPort,
}));

describe("home page initialization", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <button id="playBtn"></button>
      <button id="multiplayerBtn"></button>
      <button id="setupBtn"></button>
      <button id="howToPlayBtn"></button>
      <button id="aboutBtn"></button>
    `;
  });

  test("initHome sets up theme and navigation handlers", () => {
    const { initThemeToggle } = require("../src/theme.js");
    const { navigateTo } = require("../src/navigation.js");
    require("../src/home.js");

    document.getElementById("playBtn").click();
    document.getElementById("aboutBtn").click();

    expect(initThemeToggle).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith("./game.html");
    expect(navigateTo).toHaveBeenCalledWith("./about.html");
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });

  test("multiplayer click shows auth dialog when not logged in", async () => {
    const { navigateTo } = require("../src/navigation.js");
    mockAuthPort.currentUser.mockResolvedValueOnce(null);
    require("../src/home.js");
    document.getElementById("multiplayerBtn").click();
    await Promise.resolve();
    expect(navigateTo).not.toHaveBeenCalled();
    const dlg = document.querySelector("dialog");
    expect(dlg).not.toBeNull();
    expect(dlg.textContent).toContain("Serve un account per giocare online");
    dlg.querySelector("#loginDialogBtn").click();
    expect(navigateTo).toHaveBeenCalledWith("login.html?redirect=lobby.html");
  });

  test("multiplayer click navigates when user present", async () => {
    const { navigateTo } = require("../src/navigation.js");
    mockAuthPort.currentUser.mockResolvedValueOnce({ id: "u1" });
    require("../src/home.js");
    document.getElementById("multiplayerBtn").click();
    await Promise.resolve();
    expect(navigateTo).toHaveBeenCalledWith("./lobby.html");
  });
});
