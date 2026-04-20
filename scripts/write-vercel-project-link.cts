const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

type SpawnError = Error & {
  status?: number | null;
};

type VercelProjectList = {
  contextName?: string;
  projects?: Array<{
    id?: string;
    name?: string;
  }>;
};

type VercelTeamList = {
  teams?: Array<{
    id?: string;
    slug?: string;
    current?: boolean;
  }>;
};

function quoteWindowsArgument(value: string): string {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function runJson<T>(args: string[]): T {
  const token = process.env.VERCEL_TOKEN;
  const commandArgs = token ? args.concat(["--token", token]) : args;
  const result =
    process.platform === "win32"
      ? spawnSync(
          "cmd.exe",
          ["/d", "/s", "/c", ["vercel"].concat(commandArgs).map(quoteWindowsArgument).join(" ")],
          {
            encoding: "utf8",
            stdio: "pipe",
            cwd: process.cwd(),
            env: process.env
          }
        )
      : spawnSync("vercel", commandArgs, {
          encoding: "utf8",
          stdio: "pipe",
          cwd: process.cwd(),
          env: process.env
        });

  if (result.status !== 0) {
    const error = new Error(
      (result.stderr || result.stdout || "").trim() || `vercel ${args.join(" ")} failed`
    ) as SpawnError;
    error.status = result.status;
    throw error;
  }

  return JSON.parse(result.stdout) as T;
}

function currentProjectName(): string {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    name?: string;
  };

  if (typeof packageJson.name === "string" && packageJson.name.trim()) {
    return packageJson.name.trim();
  }

  throw new Error(`Unable to determine project name from ${packageJsonPath}`);
}

function main(): void {
  const projectFilePath = path.join(process.cwd(), ".vercel", "project.json");
  if (fs.existsSync(projectFilePath)) {
    console.log(`Using existing Vercel project link at ${projectFilePath}.`);
    return;
  }

  const projectName = currentProjectName();
  const teamList = runJson<VercelTeamList>(["teams", "ls", "--format", "json"]);
  const matchingTeam =
    (teamList.teams || []).find((team) => team.slug === process.env.VERCEL_TEAM_SLUG) ||
    (teamList.teams || []).find((team) => team.current) ||
    ((teamList.teams || []).length === 1 ? teamList.teams?.[0] : null);

  if (!matchingTeam?.id || !matchingTeam.slug) {
    throw new Error(`Unable to resolve a Vercel team scope for project ${projectName}`);
  }

  const projectList = runJson<VercelProjectList>([
    "project",
    "ls",
    "--format",
    "json",
    "--scope",
    matchingTeam.slug
  ]);
  const linkedProject = (projectList.projects || []).find(
    (project) => project.name === projectName
  );

  if (!linkedProject?.id) {
    throw new Error(
      `Unable to resolve Vercel project id for project ${projectName} in scope ${matchingTeam.slug}`
    );
  }

  fs.mkdirSync(path.dirname(projectFilePath), { recursive: true });
  fs.writeFileSync(
    projectFilePath,
    JSON.stringify(
      {
        projectId: linkedProject.id,
        orgId: matchingTeam.id,
        projectName
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`Wrote Vercel project link for ${projectName} in scope ${matchingTeam.slug}.`);
}

main();
