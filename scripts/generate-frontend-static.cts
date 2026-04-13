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

function writeTextFile(fileName: string, content: string): void {
  const absolutePath = path.join(publicDir, fileName);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content.replace(/\r?\n/g, "\n"));
}

function cleanGeneratedTextFiles(): void {
  if (!fs.existsSync(publicDir)) {
    return;
  }

  fs.readdirSync(publicDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile()) {
      return;
    }

    if (!entry.name.endsWith(".html") && !entry.name.endsWith(".css")) {
      return;
    }

    fs.rmSync(path.join(publicDir, entry.name), { force: true });
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

  const manifestUrl = pathToFileURL(path.join(publicDir, "static-site.mjs")).href + `?ts=${Date.now()}`;
  const manifest = await import(manifestUrl) as {
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

  console.log(`Generated ${manifest.frontendPageDescriptors.length} HTML pages and ${manifest.frontendStylesheets.length} stylesheets in ${publicDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
