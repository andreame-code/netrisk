import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const frontendPublicDir = resolve(process.cwd(), "public");

function collectModules(absoluteDir: string): string[] {
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      return collectModules(absolutePath);
    }

    return entry.isFile() && entry.name.endsWith(".mjs") ? [absolutePath] : [];
  });
}

const rewrittenImports: string[] = [];

for (const absolutePath of collectModules(frontendPublicDir)) {
  const source = readFileSync(absolutePath, "utf8");
  const rewritten = source
    .replace(/\.mts(?=['"])/g, ".mjs")
    .replace(/from "zod"/g, 'from "../../vendor/zod/index.js"');
  if (rewritten !== source) {
    writeFileSync(absolutePath, rewritten);
    rewrittenImports.push(absolutePath.replace(frontendPublicDir + "\\", ""));
  }
}

if (rewrittenImports.length) {
  console.log(`Synced ${rewrittenImports.join(", ")} to .mjs imports`);
}
