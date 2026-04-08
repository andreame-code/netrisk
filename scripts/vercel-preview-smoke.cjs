const fs = require("fs");
const path = require("path");

const VERCEL_API_BASE_URL = "https://api.vercel.com";
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 15000;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readLocalProjectMetadata() {
  const projectFile = path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(projectFile)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(projectFile, "utf8"));
  } catch (error) {
    return {};
  }
}

function resolveProjectId() {
  return String(process.env.VERCEL_PROJECT_ID || readLocalProjectMetadata().projectId || "").trim() || requiredEnv("VERCEL_PROJECT_ID");
}

function resolveOrgId() {
  return String(process.env.VERCEL_ORG_ID || readLocalProjectMetadata().orgId || "").trim() || requiredEnv("VERCEL_ORG_ID");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeDeployment(deployment) {
  if (!deployment) {
    return "no deployment";
  }

  const meta = deployment.meta || {};
  return JSON.stringify({
    uid: deployment.uid,
    state: deployment.state,
    readyState: deployment.readyState,
    url: deployment.url,
    branchAlias: meta.branchAlias || null,
    githubCommitRef: meta.githubCommitRef || null,
    githubCommitSha: meta.githubCommitSha || null,
    githubPrId: meta.githubPrId || null
  });
}

async function vercelRequest(pathname, init = {}) {
  const token = requiredEnv("VERCEL_TOKEN");
  const orgId = resolveOrgId();
  const separator = pathname.includes("?") ? "&" : "?";
  const response = await fetch(`${VERCEL_API_BASE_URL}${pathname}${separator}teamId=${encodeURIComponent(orgId)}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    body: init.body
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Vercel API ${pathname} failed (${response.status}): ${text}`);
  }

  return payload;
}

function isMatchingDeployment(deployment, context) {
  const meta = deployment.meta || {};
  return String(meta.githubPrId || "") === String(context.prNumber) && String(meta.githubCommitRef || "") === String(context.headRef || "");
}

function isExactCommitMatch(deployment, context) {
  const meta = deployment.meta || {};
  return String(meta.githubCommitSha || "") === String(context.headSha || "");
}

function selectBestDeployment(deployments, context) {
  const matches = deployments
    .filter((deployment) => isMatchingDeployment(deployment, context))
    .sort((left, right) => Number(right.created || 0) - Number(left.created || 0));

  if (!matches.length) {
    return null;
  }

  const exactReady = matches.find((deployment) => isExactCommitMatch(deployment, context) && deployment.readyState === "READY");
  if (exactReady) {
    return exactReady;
  }

  const exactAny = matches.find((deployment) => isExactCommitMatch(deployment, context));
  if (exactAny) {
    return exactAny;
  }

  return matches[0];
}

async function waitForPreviewDeployment(context) {
  const startedAt = Date.now();
  let lastSeen = null;

  while (Date.now() - startedAt < DEFAULT_TIMEOUT_MS) {
    const response = await vercelRequest(`/v6/deployments?projectId=${encodeURIComponent(context.projectId)}&limit=20`);
    const deployments = Array.isArray(response.deployments) ? response.deployments : [];
    const selected = selectBestDeployment(deployments, context);

    if (selected) {
      lastSeen = selected;
      if (selected.readyState === "READY") {
        return selected;
      }

      if (selected.readyState === "ERROR" || selected.state === "ERROR" || selected.readyState === "CANCELED") {
        throw new Error(`Preview deployment entered a terminal failure state: ${summarizeDeployment(selected)}`);
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for preview deployment. Last seen: ${summarizeDeployment(lastSeen)}`);
}

async function getAutomationBypassToken(projectId) {
  const payload = await vercelRequest(`/v1/projects/${encodeURIComponent(projectId)}/protection-bypass`, {
    method: "PATCH",
    body: "{}"
  });

  const protectionBypass = payload && payload.protectionBypass ? payload.protectionBypass : {};
  const entry = Object.entries(protectionBypass).find(([, value]) => value && value.scope === "automation-bypass");
  if (!entry) {
    throw new Error("No automation-bypass token found in Vercel protection bypass settings.");
  }

  return entry[0];
}

function previewBaseUrl(deployment) {
  const meta = deployment.meta || {};
  const hostname = meta.branchAlias || deployment.url;
  if (!hostname) {
    throw new Error(`Deployment is missing url and branchAlias: ${summarizeDeployment(deployment)}`);
  }

  return hostname.startsWith("http") ? hostname : `https://${hostname}`;
}

function extractSessionCookie(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const header = response.headers.getSetCookie().find((value) => value.startsWith("netrisk_session="));
    return header ? header.split(";")[0] : "";
  }

  const combined = response.headers.get("set-cookie") || "";
  const match = combined.match(/netrisk_session=([^;]+)/);
  return match ? `netrisk_session=${match[1]}` : "";
}

async function requestPreview(baseUrl, bypassToken, pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: init.method || "GET",
    headers: {
      "x-vercel-protection-bypass": bypassToken,
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.headers || {})
    },
    body: init.body,
    redirect: "follow"
  });

  return response;
}

async function assertJson(response, expectedStatus, label) {
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function runSmokeTest(baseUrl, bypassToken) {
  const lobbyResponse = await requestPreview(baseUrl, bypassToken, "/lobby.html");
  const lobbyHtml = await lobbyResponse.text();
  if (lobbyResponse.status !== 200 || !lobbyHtml.includes("data-testid=\"game-session-list\"")) {
    throw new Error(`Lobby smoke test failed with status ${lobbyResponse.status}`);
  }

  const health = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/health"), 200, "GET /api/health");
  if (!health || health.ok !== true) {
    throw new Error("GET /api/health did not return ok=true");
  }

  const games = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/games"), 200, "GET /api/games");
  if (!games || !Array.isArray(games.games)) {
    throw new Error("GET /api/games did not return a games array");
  }

  const options = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/game-options"), 200, "GET /api/game-options");
  if (!options || !Array.isArray(options.maps) || !Array.isArray(options.gameRulesets)) {
    throw new Error("GET /api/game-options did not return the expected preview catalog");
  }

  const username = `gha-preview-${Date.now()}`;
  const password = "Secret123!";
  const registerBody = JSON.stringify({ username, password });
  const register = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: registerBody
  }), 201, "POST /api/auth/register");
  if (!register || !register.ok || register.user.username !== username) {
    throw new Error("POST /api/auth/register did not create the expected user");
  }

  const loginResponse = await requestPreview(baseUrl, bypassToken, "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: registerBody
  });
  const login = await assertJson(loginResponse, 200, "POST /api/auth/login");
  const sessionCookie = extractSessionCookie(loginResponse);
  if (!login || !login.ok || login.user.username !== username || !sessionCookie) {
    throw new Error("POST /api/auth/login did not return a valid session cookie");
  }

  const session = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/auth/session", {
    cookie: sessionCookie
  }), 200, "GET /api/auth/session");
  if (!session || !session.user || session.user.username !== username) {
    throw new Error("GET /api/auth/session did not resolve the logged-in user");
  }

  const beforeCount = games.games.length;
  const createGame = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cookie: sessionCookie,
    body: JSON.stringify({ name: `CI Preview ${username}` })
  }), 201, "POST /api/games");
  if (!createGame || !createGame.game || !createGame.game.id) {
    throw new Error("POST /api/games did not return a created game");
  }

  const afterGames = await assertJson(await requestPreview(baseUrl, bypassToken, "/api/games"), 200, "GET /api/games after create");
  if (!afterGames || !Array.isArray(afterGames.games) || afterGames.games.length <= beforeCount) {
    throw new Error("GET /api/games after create did not observe the new game");
  }

  return {
    username,
    gameId: createGame.game.id,
    gameName: createGame.game.name,
    gamesBefore: beforeCount,
    gamesAfter: afterGames.games.length
  };
}

function appendStepSummary(message) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) {
    return;
  }

  fs.appendFileSync(summaryFile, `${message}\n`, "utf8");
}

async function main() {
  const context = {
    projectId: resolveProjectId(),
    prNumber: requiredEnv("GITHUB_PR_NUMBER"),
    headRef: requiredEnv("GITHUB_HEAD_REF"),
    headSha: requiredEnv("GITHUB_HEAD_SHA")
  };

  console.log(`Waiting for Vercel preview deployment for PR #${context.prNumber} (${context.headRef} @ ${context.headSha})...`);
  const deployment = await waitForPreviewDeployment(context);
  const baseUrl = previewBaseUrl(deployment);
  console.log(`Using preview deployment ${deployment.uid} at ${baseUrl}`);

  const bypassToken = await getAutomationBypassToken(context.projectId);
  const smokeResult = await runSmokeTest(baseUrl, bypassToken);

  console.log("Vercel preview smoke test passed.");
  console.log(JSON.stringify({
    previewUrl: baseUrl,
    deploymentId: deployment.uid,
    gameId: smokeResult.gameId,
    gameName: smokeResult.gameName
  }));

  appendStepSummary("## Vercel Preview Smoke");
  appendStepSummary(`- Preview URL: ${baseUrl}`);
  appendStepSummary(`- Deployment: ${deployment.uid}`);
  appendStepSummary(`- Registered user: ${smokeResult.username}`);
  appendStepSummary(`- Created game: ${smokeResult.gameName} (${smokeResult.gameId})`);
  appendStepSummary(`- Games count: ${smokeResult.gamesBefore} -> ${smokeResult.gamesAfter}`);
}

main().catch((error) => {
  const message = error && error.stack ? error.stack : String(error);
  console.error(message);
  appendStepSummary("## Vercel Preview Smoke");
  appendStepSummary("");
  appendStepSummary("Failed.");
  appendStepSummary("");
  appendStepSummary("```");
  appendStepSummary(message);
  appendStepSummary("```");
  process.exit(1);
});
