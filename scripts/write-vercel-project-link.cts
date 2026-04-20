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

type VercelUserResponse = {
  user?: {
    id?: string;
    username?: string;
  };
};

function runJson<T>(args: string[]): T {
  const token = process.env.VERCEL_TOKEN;
  const commandArgs = token ? args.concat(["--token", token]) : args;
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "vercel"].concat(commandArgs), {
          encoding: "utf8",
          stdio: "pipe",
          cwd: process.cwd(),
          env: process.env
        })
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

async function fetchAuthenticatedUser(): Promise<
  Required<NonNullable<VercelUserResponse["user"]>>
> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("VERCEL_TOKEN is required to fetch the authenticated Vercel user.");
  }

  const response = await fetch("https://api.vercel.com/v2/user", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch authenticated Vercel user: ${response.status}`);
  }

  const payload = (await response.json()) as VercelUserResponse;
  if (typeof payload.user?.id !== "string" || !payload.user.id.trim()) {
    throw new Error("Authenticated Vercel user response is missing an id.");
  }

  return {
    id: payload.user.id.trim(),
    username:
      typeof payload.user.username === "string" && payload.user.username.trim()
        ? payload.user.username.trim()
        : "personal"
  };
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

async function main(): Promise<void> {
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

  const authenticatedUser = matchingTeam?.slug ? null : await fetchAuthenticatedUser();
  const scopeLabel = matchingTeam?.slug || authenticatedUser?.username || "personal";
  const orgId = matchingTeam?.id || authenticatedUser?.id;

  if (!orgId) {
    throw new Error(`Unable to resolve a Vercel scope id for project ${projectName}`);
  }

  const projectList = runJson<VercelProjectList>(
    ["project", "ls", "--format", "json"].concat(
      matchingTeam?.slug ? ["--scope", matchingTeam.slug] : []
    )
  );
  const linkedProject = (projectList.projects || []).find(
    (project) => project.name === projectName
  );

  if (!linkedProject?.id) {
    throw new Error(
      `Unable to resolve Vercel project id for project ${projectName} in scope ${scopeLabel}`
    );
  }

  fs.mkdirSync(path.dirname(projectFilePath), { recursive: true });
  fs.writeFileSync(
    projectFilePath,
    JSON.stringify(
      {
        projectId: linkedProject.id,
        orgId,
        projectName
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`Wrote Vercel project link for ${projectName} in scope ${scopeLabel}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
