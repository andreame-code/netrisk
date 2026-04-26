const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

declare function register(name: string, fn: () => void | Promise<void>): void;

type RewriteRule = {
  source?: string;
  destination?: string;
  has?: Array<{
    type?: string;
    key?: string;
    value?: string;
  }>;
};

function loadVercelConfig(): { rewrites?: RewriteRule[] } {
  const configPath = path.join(process.cwd(), "vercel.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function hasRewriteRule(rewrites: RewriteRule[], source: string, destination: string): boolean {
  return rewrites.some((entry) => entry.source === source && entry.destination === destination);
}

function findRedirectRule(
  redirects: RewriteRule[],
  source: string,
  destination: string
): RewriteRule | undefined {
  return redirects.find((entry) => entry.source === source && entry.destination === destination);
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
    hasRewriteRule(rewrites, "/admin", "/react/index.html"),
    "Expected /admin to rewrite to /react/index.html for the canonical admin route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/admin/:path*", "/react/index.html"),
    "Expected /admin/:path* to rewrite to /react/index.html for admin deep links."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/profile", "/react/index.html"),
    "Expected /profile to rewrite to /react/index.html for the canonical profile route."
  );
  assert.ok(
    hasRewriteRule(rewrites, "/unauthorized", "/react/index.html"),
    "Expected /unauthorized to rewrite to /react/index.html for the React auth flow."
  );

  assert.ok(
    hasRewriteRule(redirects, "/legacy", "/"),
    "Expected /legacy to redirect to / for deprecated document route compatibility."
  );
  assert.ok(
    hasRewriteRule(redirects, "/legacy/lobby.html", "/lobby"),
    "Expected /legacy/lobby.html to redirect to /lobby for deprecated document route compatibility."
  );
  assert.ok(
    hasRewriteRule(redirects, "/legacy/register.html", "/register"),
    "Expected /legacy/register.html to redirect to /register for deprecated document route compatibility."
  );
  assert.ok(
    hasRewriteRule(redirects, "/legacy/new-game.html", "/lobby/new"),
    "Expected /legacy/new-game.html to redirect to /lobby/new for deprecated document route compatibility."
  );
  assert.ok(
    hasRewriteRule(redirects, "/legacy/profile.html", "/profile"),
    "Expected /legacy/profile.html to redirect to /profile for deprecated document route compatibility."
  );

  const deprecatedGameRedirect = findRedirectRule(redirects, "/legacy/game.html", "/game/:gameId");
  assert.ok(
    deprecatedGameRedirect,
    "Expected /legacy/game.html with a gameId query to redirect to /game/:gameId."
  );
  assert.deepEqual(deprecatedGameRedirect?.has, [
    {
      type: "query",
      key: "gameId",
      value: "(?<gameId>.+)"
    }
  ]);
});
