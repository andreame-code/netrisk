import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type FrontendGeneratedStylesheet = {
  fileName: string;
  content: string;
};

type FrontendGeneratedPageDescriptor = {
  fileName: string;
  route: string;
  title: string;
  stylesheets: readonly string[];
  entryModules: readonly string[];
  html: string;
};

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const legacyDir = path.join(publicDir, "legacy");
const legacyRuntimeFiles = [
  "app.mjs",
  "i18n.mjs",
  "landing.mjs",
  "layout.mjs",
  "lobby.mjs",
  "new-game.mjs",
  "profile.mjs",
  "register.mjs",
  "shell.mjs",
  "speed-insights.mjs"
] as const;
const legacyRuntimeDirectories = ["core", "locales"] as const;

function writeTextFile(fileName: string, content: string): void {
  const absolutePath = path.join(publicDir, fileName);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content.replace(/\r?\n/g, "\n"));
}

function cleanGeneratedTextFiles(): void {
  if (!fs.existsSync(publicDir)) {
    return;
  }

  [
    "index.html",
    "landing.html",
    "game.html",
    "lobby.html",
    "new-game.html",
    "profile.html",
    "register.html",
    "landing.css",
    "shell.css",
    "style.css"
  ].forEach((fileName) => {
    fs.rmSync(path.join(publicDir, fileName), { force: true });
  });

  fs.rmSync(legacyDir, { recursive: true, force: true });
}

function copyLegacyRuntimeOutputs(): void {
  fs.mkdirSync(legacyDir, { recursive: true });

  legacyRuntimeFiles.forEach((fileName) => {
    const sourcePath = path.join(publicDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      return;
    }

    const targetPath = path.join(legacyDir, fileName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.rmSync(targetPath, { force: true });
    fs.copyFileSync(sourcePath, targetPath);
  });

  legacyRuntimeDirectories.forEach((directoryName) => {
    const sourcePath = path.join(publicDir, directoryName);
    if (!fs.existsSync(sourcePath)) {
      return;
    }

    const targetPath = path.join(legacyDir, directoryName);
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  });
}

function assertDescriptorContent(page: FrontendGeneratedPageDescriptor): void {
  page.stylesheets.forEach((href) => {
    if (!page.html.includes(`href="${href}"`)) {
      throw new Error(`Page "${page.fileName}" is missing stylesheet reference "${href}".`);
    }
  });

  page.entryModules.forEach((modulePath) => {
    if (!page.html.includes(`src="${modulePath}"`)) {
      throw new Error(`Page "${page.fileName}" is missing module reference "${modulePath}".`);
    }
  });
}

async function main(): Promise<void> {
  fs.mkdirSync(publicDir, { recursive: true });
  cleanGeneratedTextFiles();

  const manifestUrl =
    pathToFileURL(path.join(publicDir, "static-site.mjs")).href + `?ts=${Date.now()}`;
  const manifest = (await import(manifestUrl)) as {
    frontendStylesheets: FrontendGeneratedStylesheet[];
    frontendPageDescriptors: FrontendGeneratedPageDescriptor[];
  };

  manifest.frontendStylesheets.forEach((stylesheet) => {
    writeTextFile(stylesheet.fileName, stylesheet.content);
  });

  manifest.frontendPageDescriptors.forEach((page) => {
    assertDescriptorContent(page);
    writeTextFile(page.fileName, page.html);
  });

  copyLegacyRuntimeOutputs();

  console.log(
    `Generated ${manifest.frontendPageDescriptors.length} HTML pages and ${manifest.frontendStylesheets.length} stylesheets in ${publicDir}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
