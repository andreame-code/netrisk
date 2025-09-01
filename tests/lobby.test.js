jest.mock("../src/navigation.js", () => ({
  goHome: jest.fn(),
  navigateTo: jest.fn(),
}));
jest.mock("../src/theme.js", () => ({ initThemeToggle: jest.fn() }));
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: {} } }),
    getUser: jest.fn().mockResolvedValue({
      data: {
        user: {
          user_metadata: { username: "testuser" },
          email: "test@example.com",
        },
      },
    }),
  },
  from: jest.fn((table) => {
    if (table === "lobby_chat") {
      const chain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      };
      return chain;
    }
    return {
      select: jest.fn().mockResolvedValue({ data: [] }),
    };
  }),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
  })),
};
jest.mock("../src/init/supabase-client.js", () => ({
  __esModule: true,
  default: mockSupabase,
}));

describe("lobby screen", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../src/config.js", () => ({ WS_URL: "ws://test" }));
    global.alert = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ maps: [{ id: "map", name: "Classic" }] }),
      }),
    );
    document.body.innerHTML = `
      <div id="lobbyError" class="hidden"><p id="lobbyErrorMsg"></p><button id="retryLobby"></button></div>
      <button id="backBtn" class="btn"></button>
      <button id="createBtn" class="btn"></button>
      <ul id="lobbyList"></ul>
      <dialog id="createDialog">
        <form id="createForm">
          <input id="roomName" />
          <input id="maxPlayers" max="8" />
          <select id="map"></select>
          <menu>
            <button type="button" id="cancelCreate" value="cancel">Cancel</button>
            <button id="submitCreate" value="default">Create</button>
          </menu>
        </form>
      </dialog>
      <ul id="chatMessages"></ul>
      <form id="chatForm"><input id="chatInput" /></form>
    `;
  });

  afterEach(() => {
    delete global.fetch;
    delete global.alert;
    localStorage.clear();
  });

  test("redirects to login when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const { navigateTo } = require("../src/navigation.js");
    require("../src/lobby.js");
    await new Promise((r) => setTimeout(r, 0));
    expect(navigateTo).toHaveBeenCalledWith("login.html?redirect=%2F");
  });

  test("does not show error when lobbies load successfully", async () => {
    require("../src/lobby.js");
    await new Promise((r) => setTimeout(r, 0));
    expect(
      document.getElementById("lobbyError").classList.contains("hidden"),
    ).toBe(true);
  });

  test("back button goes home", () => {
    const { goHome } = require("../src/navigation.js");
    require("../src/lobby.js");
    document.getElementById("backBtn").click();
    expect(goHome).toHaveBeenCalled();
  });

  test("renderLobbies displays info", () => {
    const { renderLobbies } = require("../src/lobby.js");
    const data = [
      {
        id: "abc",
        name: "host",
        playerCount: 2,
        maxPlayers: 5,
      },
    ];
    renderLobbies(data);
    const text = document.getElementById("lobbyList").textContent;
    expect(text).toContain("abc");
    expect(text).toContain("host");
    expect(text).toContain("2/5");
    expect(text).toContain("map");
    expect(text).toContain("open");
  });

  test("renderLobbies handles eight-player lobby", () => {
    const { renderLobbies } = require("../src/lobby.js");
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` }));
    const data = [
      {
        code: "xyz",
        host: "p0",
        players,
        map: "world8",
        started: false,
        maxPlayers: 8,
      },
    ];
    renderLobbies(data);
    const text = document.getElementById("lobbyList").textContent;
    expect(text).toContain("xyz");
    expect(text).toContain("8/8");
    expect(text).toContain("world8");
  });

  test("create game flow validates and sends message", async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require("../src/lobby.js");
    document.getElementById("createBtn").click();
    expect(document.getElementById("createDialog").hasAttribute("open")).toBe(
      true,
    );
    document.getElementById("roomName").value = "Room";
    document.getElementById("maxPlayers").value = "4";
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById("map").value = "map";
    document.getElementById("createForm").dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 0));
    expect(WebSocket).toHaveBeenCalled();
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalled();
    const msg = JSON.parse(wsInstance.send.mock.calls[0][0]);
    expect(msg.type).toBe("createLobby");
    expect(msg.name).toBe("Room");
    expect(msg.player.name).toBe("testuser");
    expect(msg.maxPlayers).toBe(4);
    expect(msg.map).toBe("map");
    wsInstance.onmessage({
      data: JSON.stringify({
        type: "lobby",
        code: "abc",
        host: "p1",
        players: [{ id: "p1" }],
        map: "map",
        maxPlayers: 4,
      }),
    });
    const text = document.getElementById("lobbyList").textContent;
    expect(text).toContain("abc");
    expect(text).toContain("1/4");
    delete global.WebSocket;
  });

  test("cancel closes dialog and does not send message", async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require("../src/lobby.js");
    document.getElementById("createBtn").click();
    expect(document.getElementById("createDialog").hasAttribute("open")).toBe(
      true,
    );
    document.getElementById("roomName").value = "Room";
    document.getElementById("maxPlayers").value = "2";
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById("map").value = "map";
    document.getElementById("cancelCreate").click();
    expect(document.getElementById("createDialog").hasAttribute("open")).toBe(
      false,
    );
    expect(WebSocket).not.toHaveBeenCalled();
    delete global.WebSocket;
  });

  test("invalid form does not send", () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require("../src/lobby.js");
    document.getElementById("createBtn").click();
    const form = document.getElementById("createForm");
    form.reportValidity = jest.fn();
    document.getElementById("roomName").value = "";
    document.getElementById("maxPlayers").value = "9";
    form.dispatchEvent(new Event("submit"));
    expect(WebSocket).not.toHaveBeenCalled();
    expect(form.reportValidity).toHaveBeenCalled();
    delete global.WebSocket;
  });

  test("chat sends and renders messages", async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require("../src/lobby.js");
    document.getElementById("createBtn").click();
    document.getElementById("roomName").value = "Room";
    document.getElementById("maxPlayers").value = "2";
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById("map").value = "";
    document.getElementById("createForm").dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 0));
    wsInstance.onopen();
    wsInstance.onmessage({
      data: JSON.stringify({
        type: "lobby",
        code: "abc",
        host: "p1",
        players: [{ id: "p1", name: "Host" }],
        map: null,
        maxPlayers: 2,
      }),
    });
    document.getElementById("chatInput").value = "hello";
    document.getElementById("chatForm").dispatchEvent(new Event("submit"));
    expect(wsInstance.send).toHaveBeenLastCalledWith(
      JSON.stringify({ type: "chat", code: "abc", id: "p1", text: "hello" }),
    );
    wsInstance.onmessage({
      data: JSON.stringify({ type: "chat", id: "p1", text: "hello" }),
    });
    const text = document.getElementById("chatMessages").textContent;
    expect(text).toContain("Host");
    expect(text).toContain("hello");
    delete global.WebSocket;
  });

  test("reconnects when stored credentials are present", () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    localStorage.setItem("lobbyCode", "abc");
    localStorage.setItem("playerId", "p1");
    require("../src/lobby.js");
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "reconnect", code: "abc", id: "p1" }),
    );
    delete global.WebSocket;
  });

  test("disables create button when WS_URL missing", () => {
    jest.resetModules();
    jest.doMock("../src/config.js", () => ({ WS_URL: "" }));
    require("../src/lobby.js");
    expect(document.getElementById("createBtn").disabled).toBe(true);
    expect(
      document.getElementById("lobbyError").classList.contains("hidden"),
    ).toBe(false);
  });

  test("disables create button when session is invalid", async () => {
    jest.resetModules();
    const noSessionSupabase = {
      ...mockSupabase,
      auth: {
        ...mockSupabase.auth,
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
    };
    jest.doMock("../src/init/supabase-client.js", () => ({
      __esModule: true,
      default: noSessionSupabase,
    }));
    jest.doMock("../src/config.js", () => ({ WS_URL: "ws://test" }));
    require("../src/lobby.js");
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("createBtn").disabled).toBe(true);
    expect(document.getElementById("lobbyErrorMsg").textContent).toBe(
      "Effettua il login per creare una lobby.",
    );
  });

  test("notifies user on websocket error", async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require("../src/lobby.js");
    document.getElementById("createBtn").click();
    document.getElementById("roomName").value = "Room";
    document.getElementById("maxPlayers").value = "2";
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById("map").value = "";
    document.getElementById("createForm").dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 0));
    wsInstance.onopen();
    wsInstance.onerror();
    expect(document.getElementById("lobbyErrorMsg").textContent).toBe(
      "Impossibile connettersi al server multiplayer. Riprova.",
    );
    delete global.WebSocket;
  });

  test("notifies user when server sends error message", () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    localStorage.setItem("lobbyCode", "abc");
    localStorage.setItem("playerId", "p1");
    require("../src/lobby.js");
    wsInstance.onmessage({
      data: JSON.stringify({ type: "error", error: "oops" }),
    });
    expect(document.getElementById("lobbyErrorMsg").textContent).toBe(
      "Si è verificato un errore. Riprova.",
    );
    delete global.WebSocket;
  });
});
