const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const sourceDir = path.join(rootDir, "frontend", "public");
const targetDir = path.join(rootDir, "public");

function copyDirectory(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

copyDirectory(sourceDir, targetDir);
console.log(`Synced public assets from ${sourceDir} to ${targetDir}`);
