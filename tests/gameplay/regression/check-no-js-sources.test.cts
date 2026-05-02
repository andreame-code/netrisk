const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

declare function register(name: string, fn: () => void | Promise<void>): void;

const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const builtScriptPath = path.join(projectRoot, ".tsbuild", "scripts", "check-no-js-sources.cjs");

function runGit(args: string[], cwd: string): void {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe"
  });
}

function writeFile(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function withTrackedTempRepo(run: (repoDir: string) => void): void {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-ts-allowlist-"));
  try {
    runGit(["init"], repoDir);
    run(repoDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

register("check-no-js-sources consente la react shell e i file tsx nel repo tracciato", () => {
  withTrackedTempRepo((repoDir) => {
    writeFile(
      repoDir,
      "package.json",
      JSON.stringify({
        name: "allowlist-smoke",
        private: true
      })
    );
    writeFile(
      repoDir,
      "frontend/react-shell/index.html",
      '<!doctype html><html><body><div id="root"></div></body></html>'
    );
    writeFile(repoDir, "frontend/react-shell/src/styles.css", ".shell { color: #123456; }");
    writeFile(repoDir, "frontend/react-shell/src/main.tsx", "export const App = () => null;\n");
    runGit(["add", "."], repoDir);

    const output = execFileSync(process.execPath, [builtScriptPath], {
      cwd: repoDir,
      encoding: "utf8"
    });

    assert.match(output, /Tracked repository sources satisfy the TS-complete allowlist\./);
  });
});

register("check-no-js-sources consente docs/openapi.json nel repo tracciato", () => {
  withTrackedTempRepo((repoDir) => {
    writeFile(
      repoDir,
      "package.json",
      JSON.stringify({
        name: "allowlist-openapi",
        private: true
      })
    );
    writeFile(
      repoDir,
      "docs/openapi.json",
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "NetRisk", version: "0.1.0" },
        paths: {}
      })
    );
    runGit(["add", "."], repoDir);

    const output = execFileSync(process.execPath, [builtScriptPath], {
      cwd: repoDir,
      encoding: "utf8"
    });

    assert.match(output, /Tracked repository sources satisfy the TS-complete allowlist\./);
  });
});

register("check-no-js-sources consente immagini docs/assets nel repo tracciato", () => {
  withTrackedTempRepo((repoDir) => {
    writeFile(
      repoDir,
      "package.json",
      JSON.stringify({
        name: "allowlist-docs-assets",
        private: true
      })
    );
    writeFile(repoDir, "docs/assets/player-admin-wiki-login.png", "png placeholder");
    runGit(["add", "."], repoDir);

    const output = execFileSync(process.execPath, [builtScriptPath], {
      cwd: repoDir,
      encoding: "utf8"
    });

    assert.match(output, /Tracked repository sources satisfy the TS-complete allowlist\./);
  });
});

register("check-no-js-sources consente config JSON in .github nel repo tracciato", () => {
  withTrackedTempRepo((repoDir) => {
    writeFile(
      repoDir,
      "package.json",
      JSON.stringify({
        name: "allowlist-github-json",
        private: true
      })
    );
    writeFile(
      repoDir,
      ".github/codex-pr-readiness.json",
      JSON.stringify({
        targetLabel: "codex"
      })
    );
    runGit(["add", "."], repoDir);

    const output = execFileSync(process.execPath, [builtScriptPath], {
      cwd: repoDir,
      encoding: "utf8"
    });

    assert.match(output, /Tracked repository sources satisfy the TS-complete allowlist\./);
  });
});

register("check-no-js-sources rifiuta file js tracciati fuori allowlist", () => {
  withTrackedTempRepo((repoDir) => {
    writeFile(
      repoDir,
      "package.json",
      JSON.stringify({
        name: "allowlist-violation",
        private: true
      })
    );
    writeFile(repoDir, "frontend/src/legacy.js", "console.log('legacy');\n");
    runGit(["add", "."], repoDir);

    assert.throws(
      () =>
        execFileSync(process.execPath, [builtScriptPath], {
          cwd: repoDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }),
      (error: any) => {
        assert.equal(error.status, 1);
        assert.match(
          String(error.stderr || ""),
          /Found tracked files outside the TS-complete allowlist:/
        );
        assert.match(String(error.stderr || ""), /frontend\/src\/legacy\.js/);
        return true;
      }
    );
  });
});
