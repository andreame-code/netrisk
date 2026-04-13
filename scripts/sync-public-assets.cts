import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "frontend", "assets");
const targetDir = path.join(rootDir, "public", "assets");

if (!fs.existsSync(sourceDir)) {
  console.log(`No frontend assets to sync from ${sourceDir}`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced frontend assets from ${sourceDir} to ${targetDir}`);
