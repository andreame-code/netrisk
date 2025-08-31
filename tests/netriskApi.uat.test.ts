import {
  createMatch,
  joinMatch,
  startMatch,
  sendAction,
  type CreateMatchResponse,
} from "../src/netriskApi.ts";

jest.mock("../src/config.js", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "test-key",
}));

describe("netriskApi", () => {
  const functionUrl = "https://example.supabase.co/functions/v1/netrisk";
  const headers = {
    "Content-Type": "application/json",
    apikey: "test-key",
    Authorization: "Bearer test-key",
  };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    (global as any).fetch = fetchMock;
  });

  test("createMatch sends correct payload", async () => {
    const player = { id: "p1" };
    const res: CreateMatchResponse = await createMatch(player);
    expect(fetchMock).toHaveBeenCalledWith(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "create_match", player }),
    });
    expect(res).toEqual({ ok: true });
  });

  test("joinMatch sends correct payload", async () => {
    const player = { id: "p1" };
    await joinMatch("m1", player);
    expect(fetchMock).toHaveBeenCalledWith(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "join_match", matchId: "m1", player }),
    });
  });

  test("startMatch sends correct payload", async () => {
    await startMatch("m1");
    expect(fetchMock).toHaveBeenCalledWith(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "start_match", matchId: "m1" }),
    });
  });

  test("sendAction sends correct payload", async () => {
    const payload = { move: "attack" };
    await sendAction("m1", "p1", payload);
    expect(fetchMock).toHaveBeenCalledWith(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "action",
        matchId: "m1",
        playerId: "p1",
        payload,
      }),
    });
  });

  test("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => "bad request",
    });
    await expect(createMatch({})).rejects.toThrow("bad request");
  });
});
