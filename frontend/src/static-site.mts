import { staticCssAssets, staticHtmlAssets } from "./generated/static-text-assets.mjs";

export interface FrontendGeneratedStylesheet {
  assetKey: keyof typeof staticCssAssets;
  fileName: string;
  content: string;
}

export interface FrontendGeneratedPageDescriptor {
  assetKey: keyof typeof staticHtmlAssets;
  fileName: string;
  route: string;
  title: string;
  stylesheets: readonly string[];
  entryModules: readonly string[];
  html: string;
}

const legacyAssetHrefMap: Record<string, string> = {
  "/landing.css": "/legacy/landing.css",
  "/shell.css": "/legacy/shell.css",
  "/style.css": "/legacy/style.css",
  "/speed-insights.mjs": "/legacy/speed-insights.mjs",
  "/shell.mjs": "/legacy/shell.mjs",
  "/app.mjs": "/legacy/app.mjs",
  "/lobby.mjs": "/legacy/lobby.mjs",
  "/new-game.mjs": "/legacy/new-game.mjs",
  "/profile.mjs": "/legacy/profile.mjs",
  "/register.mjs": "/legacy/register.mjs",
  "/index.html": "/legacy/index.html",
  "/landing.html": "/legacy/landing.html",
  "/game.html": "/legacy/game.html",
  "/lobby.html": "/legacy/lobby.html",
  "/new-game.html": "/legacy/new-game.html",
  "/profile.html": "/legacy/profile.html",
  "/register.html": "/legacy/register.html"
};

function rewriteLegacyHtml(html: string): string {
  return Object.entries(legacyAssetHrefMap).reduce(
    (currentHtml, [from, to]) => currentHtml.split(`"${from}"`).join(`"${to}"`),
    html
  );
}

export const frontendStylesheets: FrontendGeneratedStylesheet[] = [
  {
    assetKey: "landing.css",
    fileName: "legacy/landing.css",
    content: staticCssAssets["landing.css"]
  },
  {
    assetKey: "shell.css",
    fileName: "legacy/shell.css",
    content: staticCssAssets["shell.css"]
  },
  {
    assetKey: "style.css",
    fileName: "legacy/style.css",
    content: staticCssAssets["style.css"]
  }
];

export const frontendPageDescriptors: FrontendGeneratedPageDescriptor[] = [
  {
    assetKey: "index.html",
    fileName: "legacy/index.html",
    route: "/legacy/",
    title: "Frontline Dominion - Conquista il Mondo",
    stylesheets: ["/legacy/landing.css", "/legacy/shell.css"],
    entryModules: ["/legacy/speed-insights.mjs", "/legacy/shell.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["index.html"])
  },
  {
    assetKey: "landing.html",
    fileName: "legacy/landing.html",
    route: "/legacy/landing.html",
    title: "Frontline Dominion - Redirect",
    stylesheets: [],
    entryModules: [],
    html: rewriteLegacyHtml(staticHtmlAssets["landing.html"])
  },
  {
    assetKey: "game.html",
    fileName: "legacy/game.html",
    route: "/legacy/game.html",
    title: "Frontline Dominion",
    stylesheets: ["/legacy/style.css", "/legacy/shell.css"],
    entryModules: ["/legacy/speed-insights.mjs", "/legacy/shell.mjs", "/legacy/app.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["game.html"])
  },
  {
    assetKey: "lobby.html",
    fileName: "legacy/lobby.html",
    route: "/legacy/lobby.html",
    title: "Frontline Dominion - Lobby",
    stylesheets: ["/legacy/style.css", "/legacy/shell.css"],
    entryModules: ["/legacy/speed-insights.mjs", "/legacy/shell.mjs", "/legacy/lobby.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["lobby.html"])
  },
  {
    assetKey: "new-game.html",
    fileName: "legacy/new-game.html",
    route: "/legacy/new-game.html",
    title: "Frontline Dominion - Nuova Partita",
    stylesheets: ["/legacy/style.css", "/legacy/shell.css"],
    entryModules: ["/legacy/speed-insights.mjs", "/legacy/shell.mjs", "/legacy/new-game.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["new-game.html"])
  },
  {
    assetKey: "profile.html",
    fileName: "legacy/profile.html",
    route: "/legacy/profile.html",
    title: "Frontline Dominion - Profilo",
    stylesheets: ["/legacy/style.css", "/legacy/shell.css"],
    entryModules: ["/legacy/speed-insights.mjs", "/legacy/shell.mjs", "/legacy/profile.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["profile.html"])
  },
  {
    assetKey: "register.html",
    fileName: "legacy/register.html",
    route: "/legacy/register.html",
    title: "Frontline Dominion - Registrazione",
    stylesheets: ["/legacy/style.css", "/legacy/shell.css"],
    entryModules: ["/legacy/shell.mjs", "/legacy/register.mjs"],
    html: rewriteLegacyHtml(staticHtmlAssets["register.html"])
  }
];
