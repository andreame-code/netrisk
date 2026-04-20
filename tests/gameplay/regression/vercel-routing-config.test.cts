const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

declare function register(name: string, fn: () => void | Promise<void>): void;

type RewriteRule = {
  source?: string;
  destination?: string;
};

function loadVercelConfig(): { rewrites?: RewriteRule[] } {
  const configPath = path.join(process.cwd(), "vercel.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function hasRewriteRule(rewrites: RewriteRule[], source: string, destination: string): boolean {
  return rewrites.some((entry) => entry.source === source && entry.destination === destination);
}

register("vercel preview rewrites React shell deep links to the shell entry document", () => {
  const config = loadVercelConfig();
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  const redirects = Array.isArray((config as { redirects?: RewriteRule[] }).redirects)
    ? (config as { redirects?: RewriteRule[] }).redirects || []
    : [];

  assert.ok(
    hasRewriteRule(rewrites, "/react/:path*", "/react/index.html"),
    "Expected /react/:path* to rewrite to /react/index.html for SPA deep links."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/", "/react/index.html"),
    "Expected / to rewrite to /react/index.html for the canonical landing route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/game", "/react/index.html"),
    "Expected /game to rewrite to /react/index.html for canonical gameplay entry."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/game/:path*", "/react/index.html"),
    "Expected /game/:path* to rewrite to /react/index.html for canonical gameplay deep links."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/login", "/react/index.html"),
    "Expected /login to rewrite to /react/index.html for the React auth flow."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/register", "/react/index.html"),
    "Expected /register to rewrite to /react/index.html for the React auth flow."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/lobby", "/react/index.html"),
    "Expected /lobby to rewrite to /react/index.html for the canonical lobby route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/lobby/new", "/react/index.html"),
    "Expected /lobby/new to rewrite to /react/index.html for the canonical new game route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/profile", "/react/index.html"),
    "Expected /profile to rewrite to /react/index.html for the canonical profile route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/game.html", "/react/index.html"),
    "Expected /game.html to rewrite to /react/index.html for the compatibility gameplay bridge."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/unauthorized", "/react/index.html"),
    "Expected /unauthorized to rewrite to /react/index.html for the React auth flow."
  );

  assert.ok(
    hasRewriteRule(redirects, "/register.html", "/register"),
    "Expected /register.html to redirect to /register during the clean-route cutover."
  );
  assert.ok(
    hasRewriteRule(redirects, "/lobby.html", "/lobby"),
    "Expected /lobby.html to redirect to /lobby during the clean-route cutover."
  );
});
