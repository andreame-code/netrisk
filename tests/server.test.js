/**
 * @jest-environment node
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const bcrypt = require("bcryptjs");

let distDir;
let server;
let port;

const origin = "https://andreame-code.github.io";

const send = (options) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port, ...options },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });

beforeAll(async () => {
  process.env.PORT = 0;
  process.env.SUPABASE_URL = "http://example.com";
  process.env.SUPABASE_SERVICE_KEY = "key";
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "dist-"));
  process.env.DIST_DIR = distDir;
  server = require("../server");
  await new Promise((resolve) => server.on("listening", resolve));
  port = server.address().port;
});

afterAll(() => {
  server.close();
  fs.rmSync(distDir, { recursive: true, force: true });
  delete process.env.DIST_DIR;
});

beforeEach(() => {
  global.fetch.mockReset();
});

describe("/api/register", () => {
  test("allows POST from whitelisted origin", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const res = await send({
      path: "/api/register",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ username: "a", password: "b" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  test("rejects disallowed origin", async () => {
    const res = await send({
      path: "/api/register",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ username: "a", password: "b" }),
    });
    expect(res.status).toBe(403);
  });

  test("handles preflight OPTIONS", async () => {
    const res = await send({
      path: "/api/register",
      method: "OPTIONS",
      headers: { Origin: origin },
    });
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toBe("POST, OPTIONS");
  });

  test("rejects unsupported methods", async () => {
    const res = await send({
      path: "/api/register",
      method: "GET",
      headers: { Origin: origin },
    });
    expect(res.status).toBe(405);
  });
});

describe("/api/login", () => {
  test("returns ok for valid credentials", async () => {
    const hash = await bcrypt.hash("secret", 10);
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ password_hash: hash }],
    });
    const res = await send({
      path: "/api/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ username: "u", password: "secret" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  test("returns error for invalid credentials", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    const res = await send({
      path: "/api/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ username: "u", password: "bad" }),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      error: "Invalid username or password",
    });
  });
});

describe("static and forbidden routes", () => {
  beforeEach(() => {
    fs.writeFileSync(path.join(distDir, "index.html"), "index file");
  });

  afterEach(() => {
    fs.rmSync(path.join(distDir, "index.html"), { force: true });
  });

  test("serves index file for root", async () => {
    const res = await send({ path: "/", method: "GET" });
    expect(res.status).toBe(200);
    expect(res.body).toBe("index file");
  });

  test("returns 403 for path traversal", async () => {
    const res = await send({ path: "/../server.js", method: "GET" });
    expect(res.status).toBe(403);
  });

  test("returns 404 for missing file", async () => {
    const res = await send({ path: "/missing.html", method: "GET" });
    expect(res.status).toBe(404);
  });
});
