import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const frontendPublicDir = resolve(process.cwd(), "frontend", "public");
const jsModules = readdirSync(frontendPublicDir).filter((entry) => entry.endsWith(".mjs"));

const rewrittenImports: string[] = [];

for (const file of jsModules) {
  const absolutePath = join(frontendPublicDir, file);
  const source = readFileSync(absolutePath, "utf8");
  const rewritten = source.replace(/\.mts(?=['"])/g, ".mjs");
  if (rewritten !== source) {
    writeFileSync(absolutePath, rewritten);
    rewrittenImports.push(file);
  }
}

if (rewrittenImports.length) {
  console.log(`Synced ${rewrittenImports.join(", ")} to .mjs imports`);
}
