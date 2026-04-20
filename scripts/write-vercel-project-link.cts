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

type VercelScopeCandidate = {
  label: string;
  orgId: string;
  scopeArg?: string;
};

function runJson<T>(args: string[]): T {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "vercel"].concat(args), {
          encoding: "utf8",
          stdio: "pipe",
          cwd: process.cwd(),
          env: process.env
        })
      : spawnSync("vercel", args, {
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

function normalizeScopeArg(scopeArg: string): string {
  const normalizedScopeArg = scopeArg.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(normalizedScopeArg)) {
    throw new Error(`Unsupported Vercel scope value: ${scopeArg}`);
  }

  return normalizedScopeArg;
}

function uniqueScopeCandidates(candidates: VercelScopeCandidate[]): VercelScopeCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.orgId}:${candidate.scopeArg || ""}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function findProjectInScope(
  projectName: string,
  candidate: VercelScopeCandidate
): { projectId: string; candidate: VercelScopeCandidate } | null {
  const projectList = runJson<VercelProjectList>(
    ["project", "ls", "--format", "json"].concat(
      candidate.scopeArg ? ["--scope", normalizeScopeArg(candidate.scopeArg)] : []
    )
  );
  const linkedProject = (projectList.projects || []).find(
    (project) => project.name === projectName
  );

  if (!linkedProject?.id) {
    return null;
  }

  return {
    projectId: linkedProject.id,
    candidate
  };
}

async function main(): Promise<void> {
  const projectFilePath = path.join(process.cwd(), ".vercel", "project.json");
  if (fs.existsSync(projectFilePath)) {
    console.log(`Using existing Vercel project link at ${projectFilePath}.`);
    return;
  }

  const projectName = currentProjectName();
  const teamList = runJson<VercelTeamList>(["teams", "ls", "--format", "json"]);
  const authenticatedUser = await fetchAuthenticatedUser();
  const requestedScope = String(process.env.VERCEL_TEAM_SLUG || "").trim();
  const teamCandidates: VercelScopeCandidate[] = (teamList.teams || [])
    .filter(
      (team) =>
        typeof team.id === "string" && !!team.id && typeof team.slug === "string" && !!team.slug
    )
    .map((team) => ({
      label: normalizeScopeArg(team.slug as string),
      orgId: team.id as string,
      scopeArg: normalizeScopeArg(team.slug as string)
    }));
  const personalCandidate: VercelScopeCandidate = {
    label: normalizeScopeArg(authenticatedUser.username),
    orgId: authenticatedUser.id,
    scopeArg: normalizeScopeArg(authenticatedUser.username)
  };
  const allScopeCandidates = uniqueScopeCandidates(teamCandidates.concat([personalCandidate]));
  const normalizedRequestedScope = requestedScope ? normalizeScopeArg(requestedScope) : "";
  const scopeCandidates = normalizedRequestedScope
    ? allScopeCandidates.filter((candidate) => candidate.scopeArg === normalizedRequestedScope)
    : allScopeCandidates;

  if (normalizedRequestedScope && !scopeCandidates.length) {
    throw new Error(`Unable to resolve requested Vercel scope ${normalizedRequestedScope}.`);
  }
  const resolvedProject = scopeCandidates.reduce<{
    projectId: string;
    candidate: VercelScopeCandidate;
  } | null>((found, candidate) => {
    if (found) {
      return found;
    }

    return findProjectInScope(projectName, candidate);
  }, null);

  if (!resolvedProject) {
    const searchedScopes = scopeCandidates.map((candidate) => candidate.label).join(", ");
    throw new Error(
      `Unable to resolve Vercel project id for project ${projectName} in scopes ${searchedScopes}`
    );
  }

  fs.mkdirSync(path.dirname(projectFilePath), { recursive: true });
  fs.writeFileSync(
    projectFilePath,
    JSON.stringify(
      {
        projectId: resolvedProject.projectId,
        orgId: resolvedProject.candidate.orgId,
        projectName
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `Wrote Vercel project link for ${projectName} in scope ${resolvedProject.candidate.label}.`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
