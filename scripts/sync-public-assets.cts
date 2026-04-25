import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const sourceDir = path.join(rootDir, "frontend", "assets");
const targetDir = path.join(publicDir, "assets");
const staleLegacyPaths = [
  "legacy",
  "vendor",
  "app.mjs",
  "landing.mjs",
  "layout.mjs",
  "lobby.mjs",
  "new-game.mjs",
  "profile.mjs",
  "register.mjs",
  "shell.mjs",
  "speed-insights.mjs",
  "landing.css",
  "shell.css",
  "style.css",
  "index.html",
  "landing.html",
  "game.html",
  "lobby.html",
  "new-game.html",
  "profile.html",
  "register.html",
  path.join("generated", "static-text-assets.mjs")
];

staleLegacyPaths.forEach((relativePath) => {
  fs.rmSync(path.join(publicDir, relativePath), {
    recursive: true,
    force: true
  });
});

if (!fs.existsSync(sourceDir)) {
  console.log(`No frontend assets to sync from ${sourceDir}`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced frontend assets from ${sourceDir} to ${targetDir}`);
