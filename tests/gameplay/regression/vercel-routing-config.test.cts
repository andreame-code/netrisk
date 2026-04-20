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

  assert.ok(
    hasRewriteRule(rewrites, "/react/:path*", "/react/index.html"),
    "Expected /react/:path* to rewrite to /react/index.html for SPA deep links."
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
    hasRewriteRule(rewrites, "/register.html", "/react/index.html"),
    "Expected /register.html to rewrite to /react/index.html for the canonical auth alias."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/unauthorized", "/react/index.html"),
    "Expected /unauthorized to rewrite to /react/index.html for the React auth flow."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/lobby.html", "/react/index.html"),
    "Expected /lobby.html to rewrite to /react/index.html for the canonical lobby route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/new-game.html", "/react/index.html"),
    "Expected /new-game.html to rewrite to /react/index.html for the canonical new-game route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/profile.html", "/react/index.html"),
    "Expected /profile.html to rewrite to /react/index.html for the canonical profile route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/game.html", "/react/index.html"),
    "Expected /game.html to rewrite to /react/index.html for the canonical gameplay document alias."
  );
});
