import { staticCssAssets, staticHtmlAssets } from "./generated/static-text-assets.mjs";

export interface FrontendGeneratedStylesheet {
  fileName: keyof typeof staticCssAssets;
  content: string;
}

export interface FrontendGeneratedPageDescriptor {
  fileName: keyof typeof staticHtmlAssets;
  route: string;
  title: string;
  stylesheets: readonly string[];
  entryModules: readonly string[];
  html: string;
}

export const frontendStylesheets: FrontendGeneratedStylesheet[] = [
  {
    fileName: "landing.css",
    content: staticCssAssets["landing.css"]
  },
  {
    fileName: "shell.css",
    content: staticCssAssets["shell.css"]
  },
  {
    fileName: "style.css",
    content: staticCssAssets["style.css"]
  }
];

export const frontendPageDescriptors: FrontendGeneratedPageDescriptor[] = [
  {
    fileName: "index.html",
    route: "/",
    title: "Frontline Dominion - Conquista il Mondo",
    stylesheets: ["/landing.css", "/shell.css"],
    entryModules: ["/speed-insights.mjs", "/shell.mjs"],
    html: staticHtmlAssets["index.html"]
  },
  {
    fileName: "landing.html",
    route: "/landing.html",
    title: "Frontline Dominion - Redirect",
    stylesheets: [],
    entryModules: [],
    html: staticHtmlAssets["landing.html"]
  },
  {
    fileName: "game.html",
    route: "/game.html",
    title: "Frontline Dominion",
    stylesheets: ["/style.css", "/shell.css"],
    entryModules: ["/speed-insights.mjs", "/shell.mjs", "/app.mjs"],
    html: staticHtmlAssets["game.html"]
  },
  {
    fileName: "lobby.html",
    route: "/lobby.html",
    title: "Frontline Dominion - Lobby",
    stylesheets: ["/style.css", "/shell.css"],
    entryModules: ["/speed-insights.mjs", "/shell.mjs", "/lobby.mjs"],
    html: staticHtmlAssets["lobby.html"]
  },
  {
    fileName: "new-game.html",
    route: "/new-game.html",
    title: "Frontline Dominion - Nuova Partita",
    stylesheets: ["/style.css", "/shell.css"],
    entryModules: ["/speed-insights.mjs", "/shell.mjs", "/new-game.mjs"],
    html: staticHtmlAssets["new-game.html"]
  },
  {
    fileName: "profile.html",
    route: "/profile.html",
    title: "Frontline Dominion - Profilo",
    stylesheets: ["/style.css", "/shell.css"],
    entryModules: ["/speed-insights.mjs", "/shell.mjs", "/profile.mjs"],
    html: staticHtmlAssets["profile.html"]
  },
  {
    fileName: "register.html",
    route: "/register.html",
    title: "Frontline Dominion - Registrazione",
    stylesheets: ["/style.css", "/shell.css"],
    entryModules: ["/shell.mjs", "/register.mjs"],
    html: staticHtmlAssets["register.html"]
  }
];
