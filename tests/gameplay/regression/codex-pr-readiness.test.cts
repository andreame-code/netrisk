const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  READY_COMMENT_HEADING,
  evaluateReadinessFromSnapshot,
  isTargetPullRequest,
  loadGateConfig,
  parseAddedLines,
  __testables: {
    GitHubApiClient,
    applyEvaluation,
    buildBatchSummary,
    getSnapshot,
    parseArgs,
    parseEventPrNumbers,
    resolveTargetPrNumbers,
    upsertSummaryComment
  }
} = require("../../../scripts/evaluate-codex-pr-readiness.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

const config = loadGateConfig(path.join(process.cwd(), ".github", "codex-pr-readiness.json"));

function createQualityJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: "quality",
    htmlUrl: "https://example.test/quality",
    status: "completed",
    conclusion: "success",
    startedAt: "2026-04-23T10:01:00.000Z",
    completedAt: "2026-04-23T10:05:00.000Z",
    workflowName: "Quality",
    steps: [
      { name: "Run repository typecheck", status: "completed", conclusion: "success" },
      { name: "Run React shell typecheck", status: "completed", conclusion: "success" },
      { name: "Run build", status: "completed", conclusion: "success" },
      { name: "Run lint", status: "completed", conclusion: "success" },
      { name: "Run format check", status: "completed", conclusion: "success" },
      { name: "Run React shell tests", status: "completed", conclusion: "success" }
    ],
    ...overrides
  };
}

function createSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    pr: {
      number: 146,
      nodeId: "PR_node",
      title: "Codex draft",
      url: "https://example.test/pr/146",
      state: "open",
      isDraft: true,
      authorLogin: "andreame-code",
      baseRefName: "main",
      headRefName: "codex/pr-readiness-gate-20260423",
      headSha: "abcdef1234567890abcdef1234567890abcdef12",
      headCommitAt: "2026-04-23T10:00:00.000Z",
      labels: [],
      additions: 24,
      deletions: 4,
      changedFiles: 3,
      mergeable: true,
      mergeableState: "clean"
    },
    branchFreshness: {
      behindBy: 0,
      aheadBy: 2,
      status: "ahead",
      url: "https://example.test/compare"
    },
    workflowJobs: [
      createQualityJob(),
      {
        id: 20,
        name: "coverage",
        htmlUrl: "https://example.test/coverage",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-04-23T10:01:00.000Z",
        completedAt: "2026-04-23T10:05:00.000Z",
        workflowName: "Coverage",
        steps: []
      },
      {
        id: 30,
        name: "e2e-smoke",
        htmlUrl: "https://example.test/e2e",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-04-23T10:01:00.000Z",
        completedAt: "2026-04-23T10:05:00.000Z",
        workflowName: "E2E Smoke",
        steps: []
      },
      {
        id: 40,
        name: "Analyze (javascript-typescript)",
        htmlUrl: "https://example.test/codeql",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-04-23T10:01:00.000Z",
        completedAt: "2026-04-23T10:05:00.000Z",
        workflowName: "CodeQL Advanced",
        steps: []
      }
    ],
    reviewThreads: [],
    codexSignals: [
      {
        actorLogin: "chatgpt-codex-connector",
        state: "APPROVED",
        body: "Codex greenlight",
        submittedAt: "2026-04-23T10:10:00.000Z",
        url: "https://example.test/review",
        kind: "review"
      }
    ],
    changedFiles: [
      {
        path: "backend/readiness-gate.cts",
        status: "modified",
        additions: 18,
        deletions: 2,
        changes: 20,
        patch: "@@ -1,1 +1,2 @@\n+const ready = true;\n+export { ready };"
      },
      {
        path: "tests/gameplay/regression/codex-pr-readiness.test.cts",
        status: "modified",
        additions: 12,
        deletions: 0,
        changes: 12,
        patch: "@@ -1,1 +1,2 @@\n+register('ready gate', () => {});\n+assert.equal(true, true);"
      },
      {
        path: "docs/codex-pr-readiness-gate.md",
        status: "modified",
        additions: 6,
        deletions: 0,
        changes: 6,
        patch: "@@ -1,1 +1,2 @@\n+# Readiness gate\n+Updated docs."
      }
    ],
    ...overrides
  };
}

function createTempJsonFile(name: string, payload: unknown) {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "codex-pr-readiness-"));
  const filePath = path.join(dirPath, name);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return {
    dirPath,
    filePath
  };
}

function createFakeClient(
  routes: Record<string, unknown>,
  graphqlHandler?: (
    query: string,
    variables: Record<string, unknown>
  ) => unknown | Promise<unknown>,
  authenticatedLogin = "github-actions[bot]"
) {
  const calls: Array<Record<string, unknown>> = [];

  return {
    owner: "andreame-code",
    repo: "netrisk",
    calls,
    async requestJson(method: string, requestPath: string, body?: Record<string, unknown>) {
      calls.push({
        kind: "rest",
        method,
        requestPath,
        body: body || null
      });
      const key = `${method} ${requestPath}`;
      if (!(key in routes)) {
        throw new Error(`Unexpected route ${key}`);
      }

      const response = routes[key];
      return typeof response === "function" ? await response(body) : response;
    },
    async getAuthenticatedLogin() {
      return authenticatedLogin;
    },
    async graphql(query: string, variables: Record<string, unknown>) {
      calls.push({
        kind: "graphql",
        query,
        variables
      });
      return graphqlHandler ? await graphqlHandler(query, variables) : {};
    }
  };
}

register("codex PR readiness targets only draft Codex PRs", () => {
  const branchTarget = isTargetPullRequest(createSnapshot().pr, config);
  assert.equal(branchTarget.targeted, true);

  const labelTarget = isTargetPullRequest(
    {
      ...createSnapshot().pr,
      headRefName: "feature/plain-branch",
      labels: ["codex"]
    },
    config
  );
  assert.equal(labelTarget.targeted, true);

  const skipped = isTargetPullRequest(
    {
      ...createSnapshot().pr,
      isDraft: false,
      labels: ["codex"]
    },
    config
  );
  assert.equal(skipped.targeted, false);
});

register("codex PR readiness workflow is disabled while keeping the file in place", () => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "codex-pr-readiness.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /Disabled on purpose until the readiness automation is reworked\./);
  assert.match(workflow, /codex-pr-readiness:\s*\n\s*# Disabled on purpose until the readiness automation is reworked\.\s*\n\s*if: false/);
});

register("codex PR readiness workflow targets only draft Codex PRs", () => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "codex-pr-readiness.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /const TARGET_LABEL = "codex";/);
  assert.match(workflow, /const BRANCH_PREFIX = "codex\/";/);
  assert.match(
    workflow,
    /if \(!pr \|\| pr\.state !== "open" \|\| pr\.draft !== true\) return false;/
  );
  assert.match(workflow, /labels\.includes\(TARGET_LABEL\)/);
  assert.match(workflow, /headRef\.startsWith\(BRANCH_PREFIX\)/);
  assert.match(workflow, /CODEX_ACTORS\.some\(\(actor\) => author === normalize\(actor\)\)/);
  assert.match(workflow, /Skipping PR #\$\{prNumber\}: not a targeted draft Codex PR\./);
  assert.doesNotMatch(workflow, /return \[context\.payload\.pull_request\.number\];/);

  const filteredEventReturns =
    workflow.match(/return isAutomationTargetPr\(pr\) \? \[pr\.number\] : \[\];/g) || [];
  assert.equal(filteredEventReturns.length >= 3, true);
});

register("codex PR readiness workflow marks fully ready drafts ready for review", () => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "codex-pr-readiness.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /async function markReadyForReview\(pr\)/);
  assert.match(
    workflow,
    /markPullRequestReadyForReview\(input: \{ pullRequestId: \$pullRequestId \}\)/
  );
  assert.match(workflow, /pullRequestId: pr\.node_id/);
  assert.match(workflow, /pr\.draft = false;/);
  assert.match(workflow, /else if \(checkState\.state === "green" && codexOk\) \{/);
  assert.match(workflow, /action = "mark-ready";/);
  assert.match(workflow, /await markReadyForReview\(pr\);/);
});

register("codex PR readiness watchdog ignores non-actionable Codex status comments", () => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "codex-pr-readiness.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /function isNonActionableCodexSignal\(text\)/);
  assert.match(workflow, /function isNegativeNonProblemCodexSignal\(text\)/);
  assert.match(workflow, /function isCodexExecutionSummary\(text\)/);
  assert.match(workflow, /function isSkippableCodexExecutionSignal\(text\)/);
  assert.match(workflow, /function hasBlockingCodexMarker\(text\)/);
  assert.match(workflow, /function hasNegatedRegressionRiskSignal\(text\)/);
  assert.match(workflow, /function stripNegatedRegressionRiskPhrases\(text\)/);
  assert.match(
    workflow,
    /function reviewCommentIsForCurrentHead\(item, sha, headDate, staleReviewCommentUrls = new Set\(\)\)/
  );
  assert.match(workflow, /function getReviewThreads\(prNumber\)/);
  assert.match(workflow, /function hydrateReviewThreadComments\(thread\)/);
  assert.match(workflow, /function buildStaleReviewCommentUrls\(reviewThreads\)/);
  assert.match(workflow, /comments\(first: 100, after: \$cursor\)/);
  assert.match(workflow, /await hydrateReviewThreadComments\(thread\)/);
  assert.doesNotMatch(workflow, /item\?\.original_commit_id && item\.original_commit_id !== sha/);
  assert.match(workflow, /staleReviewCommentUrls\.has\(url\)/);
  assert.match(
    workflow,
    /reviewCommentIsForCurrentHead\(item, sha, headDate, staleReviewCommentUrls\)/
  );
  const reviewCommentFreshnessBody = workflow.match(
    /function reviewCommentIsForCurrentHead[\s\S]+?return itemIsForCurrentHead\(item, sha, headDate\);\s+}/
  )?.[0];
  assert.ok(reviewCommentFreshnessBody);
  const staleReviewUrlIndex = reviewCommentFreshnessBody.indexOf(
    "if (url && staleReviewCommentUrls.has(url)) return false;"
  );
  const bodyShaIndex = reviewCommentFreshnessBody.indexOf(
    "if (bodyHasCurrentSha(item?.body, sha)) return true;"
  );
  assert.equal(staleReviewUrlIndex >= 0, true);
  assert.equal(bodyShaIndex > staleReviewUrlIndex, true);
  assert.match(workflow, /if \(hasBlockingCodexMarker\(body\)\) return false;/);
  assert.match(
    workflow,
    /return isCodexExecutionSummary\(body\) \|\| isCodexExecutionPlan\(body\);/
  );
  assert.match(workflow, /hasUnresolvedWorkSignal/);
  assert.match(workflow, /hasResolvedWorkSignal/);
  assert.match(workflow, /hasCompletedActionSignal/);
  assert.match(workflow, /\(\?:not\|never\)\\s\+\(\?:fixed\|addressed\|resolved\)/);
  assert.match(workflow, /!hasUnresolvedWorkSignal &&/);
  assert.match(workflow, /!hasUnresolvedWorkSignal &&\s+hasCompletedActionSignal/);
  assert.doesNotMatch(workflow, /body\.includes\("non-actionable"\) \|\|/);
  assert.match(workflow, /body\.includes\("this trigger is non-actionable right now"\)/);
  assert.match(workflow, /body\.includes\("non-actionable triage note"\)/);
  assert.match(workflow, /body\.includes\("wait for ci"\)/);
  assert.doesNotMatch(workflow, /body\.includes\("checks are pending"\)/);
  assert.doesNotMatch(workflow, /body\.includes\("checks still pending"\)/);
  assert.match(workflow, /body\.includes\("nothing to fix yet"\)/);
  assert.match(workflow, /body\.includes\("no code-change action"\)/);
  assert.match(workflow, /body\.includes\("no code changes are needed"\)/);
  assert.match(workflow, /body\.includes\("not opening a follow-up pr"\)/);
  assert.match(workflow, /body\.includes\("all tests are passing"\)/);
  assert.match(workflow, /body\.includes\("all tests passed"\)/);
  assert.match(workflow, /body\.includes\("no failing checks or requested code updates"\)/);
  assert.match(workflow, /hasNegatedRegressionRiskSignal\(body\)/);
  assert.match(workflow, /stripNegatedRegressionRiskPhrases\(body\)/);
  assert.match(
    workflow,
    /hasNegatedRegressionRiskSignal\(body\) &&\s+!hasGenericProblemSignal\(stripNegatedRegressionRiskPhrases\(body\)\)/
  );
  assert.doesNotMatch(
    workflow,
    /currentCodexSignals\.some\(\(signal\) => bodyHasCurrentSha\(signal\.body, sha\)\)/
  );
  assert.match(workflow, /isCleanCodexSignal\(latestCodexSignal\?\.body \|\| ""\)/);
  assert.match(workflow, /\\bno\\s\+regression\\s\+risk\\b/);
  assert.match(
    workflow,
    /\\bregression\\s\+risk\\b\/i\.test\(body\) && !hasNegatedRegressionRiskSignal\(body\)/
  );
  const cleanFunctionBlock = workflow.slice(
    workflow.indexOf("function isCleanCodexSignal(text)"),
    workflow.indexOf("function isNegativeNonProblemCodexSignal(text)")
  );
  assert.doesNotMatch(cleanFunctionBlock, /no failing checks or requested code updates/);
  assert.doesNotMatch(cleanFunctionBlock, /did not find any regression risk/);
  assert.doesNotMatch(cleanFunctionBlock, /no actionable blocking defect/);
  assert.doesNotMatch(cleanFunctionBlock, /all tests are passing/);
  assert.doesNotMatch(cleanFunctionBlock, /all tests passed/);
  const cleanIndex = workflow.indexOf("if (isCleanCodexSignal(body)) return false;");
  const blockingMarkerIndex = workflow.indexOf("if (hasBlockingCodexMarker(body)) return true;");
  const skippableExecutionIndex = workflow.indexOf(
    "if (isSkippableCodexExecutionSignal(body)) return false;"
  );
  const negativeNonProblemIndex = workflow.indexOf(
    "if (isNegativeNonProblemCodexSignal(body)) return false;"
  );
  const nonActionableIndex = workflow.indexOf(
    "if (isNonActionableCodexSignal(body)) return false;"
  );
  const genericProblemIndex = workflow.indexOf("if (hasGenericProblemSignal(body)) return true;");
  assert.equal(cleanIndex >= 0, true);
  assert.equal(blockingMarkerIndex > cleanIndex, true);
  assert.equal(skippableExecutionIndex > blockingMarkerIndex, true);
  assert.equal(negativeNonProblemIndex > skippableExecutionIndex, true);
  assert.equal(nonActionableIndex > negativeNonProblemIndex, true);
  assert.equal(genericProblemIndex > nonActionableIndex, true);
});

register(
  "codex PR readiness blocks pending checks, stale Codex feedback, stale branches, and conflicts",
  () => {
    const evaluation = evaluateReadinessFromSnapshot(
      createSnapshot({
        pr: {
          ...createSnapshot().pr,
          mergeable: false,
          mergeableState: "dirty"
        },
        branchFreshness: {
          behindBy: 3,
          aheadBy: 2,
          status: "behind",
          url: "https://example.test/compare"
        },
        workflowJobs: [
          createQualityJob({
            status: "in_progress",
            conclusion: null,
            steps: [
              { name: "Run repository typecheck", status: "completed", conclusion: "success" },
              { name: "Run React shell typecheck", status: "completed", conclusion: "success" },
              { name: "Run build", status: "in_progress", conclusion: null },
              { name: "Run lint", status: "queued", conclusion: null },
              { name: "Run format check", status: "queued", conclusion: null },
              { name: "Run React shell tests", status: "queued", conclusion: null }
            ]
          }),
          {
            id: 20,
            name: "coverage",
            htmlUrl: "https://example.test/coverage",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-04-23T10:01:00.000Z",
            completedAt: "2026-04-23T10:05:00.000Z",
            workflowName: "Coverage",
            steps: []
          },
          {
            id: 30,
            name: "e2e-smoke",
            htmlUrl: "https://example.test/e2e",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-04-23T10:01:00.000Z",
            completedAt: "2026-04-23T10:05:00.000Z",
            workflowName: "E2E Smoke",
            steps: []
          },
          {
            id: 40,
            name: "Analyze (javascript-typescript)",
            htmlUrl: "https://example.test/codeql",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-04-23T10:01:00.000Z",
            completedAt: "2026-04-23T10:05:00.000Z",
            workflowName: "CodeQL Advanced",
            steps: []
          }
        ],
        reviewThreads: [
          {
            id: "thread-1",
            isResolved: false,
            isOutdated: false,
            comments: [
              {
                authorLogin: "chatgpt-codex-connector",
                body: "Please fix this before merge.",
                createdAt: "2026-04-23T10:12:00.000Z",
                url: "https://example.test/thread-1"
              }
            ]
          }
        ],
        codexSignals: [
          {
            actorLogin: "chatgpt-codex-connector",
            state: "COMMENTED",
            body: "Need follow-up changes.",
            submittedAt: "2026-04-23T10:11:00.000Z",
            url: "https://example.test/review",
            kind: "review"
          }
        ]
      }),
      config
    );

    const blockerCodes = evaluation.blockers.map((blocker: { code: string }) => blocker.code);
    assert.equal(evaluation.decision, "blocked");
    assert.equal(blockerCodes.includes("required-check-pending:quality"), true);
    assert.equal(blockerCodes.includes("quality-step-pending:build"), true);
    assert.equal(blockerCodes.includes("unresolved-review-threads"), true);
    assert.equal(blockerCodes.includes("stale-codex-greenlight"), true);
    assert.equal(blockerCodes.includes("branch-stale"), true);
    assert.equal(blockerCodes.includes("not-mergeable"), true);
  }
);

register("codex PR readiness returns READY only when all hard blockers clear", () => {
  const evaluation = evaluateReadinessFromSnapshot(createSnapshot(), config);

  assert.equal(evaluation.decision, "ready");
  assert.equal(evaluation.blockers.length, 0);
  assert.equal(evaluation.advisories.length, 0);
  assert.match(evaluation.summary, new RegExp(escapeForRegExp(READY_COMMENT_HEADING)));
  assert.match(evaluation.summary, /Ready for review/i);
});

register(
  "codex PR readiness blocks skipped tests, temporary leftovers, and missing generated sync",
  () => {
    const evaluation = evaluateReadinessFromSnapshot(
      createSnapshot({
        changedFiles: [
          {
            path: "shared/runtime-validation.cts",
            status: "modified",
            additions: 4,
            deletions: 1,
            changes: 5,
            patch: "@@ -1,1 +1,2 @@\n+export const x = 1;\n+// TODO sync runtime"
          },
          {
            path: "backend/readiness-gate.cts",
            status: "modified",
            additions: 2,
            deletions: 0,
            changes: 2,
            patch: "@@ -1,1 +1,2 @@\n+console.log('debug');\n+export const y = 2;"
          },
          {
            path: "tests/gameplay/regression/readiness.test.cts",
            status: "modified",
            additions: 2,
            deletions: 0,
            changes: 2,
            patch: "@@ -1,1 +1,2 @@\n+it.skip('not ready', () => {});\n+assert.equal(true, true);"
          }
        ]
      }),
      config
    );

    const blockerCodes = evaluation.blockers.map((blocker: { code: string }) => blocker.code);
    assert.equal(evaluation.decision, "blocked");
    assert.equal(blockerCodes.includes("skipped-tests-introduced"), true);
    assert.equal(blockerCodes.includes("temporary-leftovers"), true);
    assert.equal(blockerCodes.includes("sync-requirement-1"), true);
  }
);

register(
  "codex PR readiness emits soft advisories for coverage risk, missing docs, and large diffs",
  () => {
    const evaluation = evaluateReadinessFromSnapshot(
      createSnapshot({
        changedFiles: [
          {
            path: "backend/heavy-change.cts",
            status: "modified",
            additions: 420,
            deletions: 20,
            changes: 440,
            patch: "@@ -1,1 +1,2 @@\n+export const heavy = true;\n+export const stillHeavy = true;"
          },
          {
            path: "frontend/react-shell/src/admin-route.tsx",
            status: "modified",
            additions: 300,
            deletions: 10,
            changes: 310,
            patch:
              "@@ -1,1 +1,2 @@\n+export function Ready() { return null; }\n+export const mode = 'ready';"
          }
        ]
      }),
      config
    );

    const advisoryCodes = evaluation.advisories.map((advisory: { code: string }) => advisory.code);
    assert.equal(evaluation.decision, "ready");
    assert.equal(advisoryCodes.includes("large-diff"), true);
    assert.equal(advisoryCodes.includes("missing-docs"), true);
    assert.equal(advisoryCodes.includes("coverage-risk-backend"), true);
    assert.equal(advisoryCodes.includes("coverage-risk-frontend"), true);
    assert.equal(advisoryCodes.includes("low-test-additions"), true);
  }
);

register("codex PR readiness parses added diff lines only", () => {
  assert.deepEqual(parseAddedLines("@@ -1,1 +1,3 @@\n line\n+added\n+++ ignore\n+also added"), [
    "added",
    "also added"
  ]);
});

register("codex PR readiness parses CLI args and GitHub event payloads", () => {
  assert.deepEqual(
    parseArgs([
      "--apply",
      "--config",
      "config.json",
      "--event-path",
      "event.json",
      "--repository",
      "andreame-code/netrisk",
      "--pr-number",
      "42",
      "--pr-number",
      "43",
      "--json-output",
      "out.json",
      "--summary-output",
      "summary.md"
    ]),
    {
      apply: true,
      configPath: "config.json",
      eventPath: "event.json",
      repository: "andreame-code/netrisk",
      prNumbers: [42, 43],
      jsonOutputPath: "out.json",
      summaryOutputPath: "summary.md"
    }
  );

  assert.deepEqual(parseEventPrNumbers(null), []);

  const previousEventName = process.env.GITHUB_EVENT_NAME;
  const pullRequestEvent = createTempJsonFile("pull-request.json", {
    pull_request: { number: 71 }
  });
  const issueCommentEvent = createTempJsonFile("issue-comment.json", {
    issue: {
      number: 72,
      pull_request: {
        url: "https://example.test/pr/72"
      }
    }
  });
  const workflowRunEvent = createTempJsonFile("workflow-run.json", {
    workflow_run: {
      pull_requests: [{ number: 73 }, { number: 0 }, { number: "74" }]
    }
  });
  const workflowDispatchEvent = createTempJsonFile("workflow-dispatch.json", {
    inputs: {
      pr_number: "75"
    }
  });

  try {
    delete process.env.GITHUB_EVENT_NAME;
    assert.deepEqual(parseEventPrNumbers(pullRequestEvent.filePath), [71]);

    process.env.GITHUB_EVENT_NAME = "issue_comment";
    assert.deepEqual(parseEventPrNumbers(issueCommentEvent.filePath), [72]);

    process.env.GITHUB_EVENT_NAME = "workflow_run";
    assert.deepEqual(parseEventPrNumbers(workflowRunEvent.filePath), [73, 74]);

    process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
    assert.deepEqual(parseEventPrNumbers(workflowDispatchEvent.filePath), [75]);
  } finally {
    if (typeof previousEventName === "string") {
      process.env.GITHUB_EVENT_NAME = previousEventName;
    } else {
      delete process.env.GITHUB_EVENT_NAME;
    }
    fs.rmSync(pullRequestEvent.dirPath, { recursive: true, force: true });
    fs.rmSync(issueCommentEvent.dirPath, { recursive: true, force: true });
    fs.rmSync(workflowRunEvent.dirPath, { recursive: true, force: true });
    fs.rmSync(workflowDispatchEvent.dirPath, { recursive: true, force: true });
  }
});

register(
  "codex PR readiness resolves explicit, event, and scheduled target PR numbers",
  async () => {
    const eventPayload = createTempJsonFile("workflow-run.json", {
      workflow_run: {
        pull_requests: [{ number: 81 }, { number: 82 }]
      }
    });
    const previousEventName = process.env.GITHUB_EVENT_NAME;
    const client = createFakeClient({
      "GET /repos/andreame-code/netrisk/pulls?state=open&per_page=100&page=1": [
        {
          number: 10,
          draft: true,
          state: "open",
          labels: [{ name: "codex" }],
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "feature/content-studio", sha: "sha-10" }
        },
        {
          number: 11,
          draft: true,
          state: "open",
          labels: [],
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "codex/quality-gate", sha: "sha-11" }
        },
        {
          number: 12,
          draft: false,
          state: "open",
          labels: [{ name: "codex" }],
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "feature/not-targeted", sha: "sha-12" }
        },
        {
          number: 13,
          draft: true,
          state: "open",
          labels: [],
          user: { login: "chatgpt-codex-connector" },
          base: { ref: "main" },
          head: { ref: "feature/codex-author", sha: "sha-13" }
        }
      ],
      "GET /repos/andreame-code/netrisk/pulls?state=open&per_page=100&page=2": []
    });

    try {
      assert.deepEqual(
        await resolveTargetPrNumbers(
          client,
          {
            apply: false,
            configPath: null,
            eventPath: null,
            repository: null,
            prNumbers: [99, 99, 0],
            jsonOutputPath: null,
            summaryOutputPath: null
          },
          config
        ),
        [99]
      );

      process.env.GITHUB_EVENT_NAME = "workflow_run";
      assert.deepEqual(
        await resolveTargetPrNumbers(
          client,
          {
            apply: false,
            configPath: null,
            eventPath: eventPayload.filePath,
            repository: null,
            prNumbers: [],
            jsonOutputPath: null,
            summaryOutputPath: null
          },
          config
        ),
        [81, 82]
      );

      delete process.env.GITHUB_EVENT_NAME;
      assert.deepEqual(
        await resolveTargetPrNumbers(
          client,
          {
            apply: false,
            configPath: null,
            eventPath: null,
            repository: null,
            prNumbers: [],
            jsonOutputPath: null,
            summaryOutputPath: null
          },
          config
        ),
        [10, 11, 13]
      );
    } finally {
      if (typeof previousEventName === "string") {
        process.env.GITHUB_EVENT_NAME = previousEventName;
      } else {
        delete process.env.GITHUB_EVENT_NAME;
      }
      fs.rmSync(eventPayload.dirPath, { recursive: true, force: true });
    }
  }
);

register("codex PR readiness snapshots GitHub metadata into the evaluation input", async () => {
  const client = createFakeClient(
    {
      "GET /repos/andreame-code/netrisk/pulls/146": {
        number: 146,
        node_id: "PR_node",
        title: "Codex readiness gate",
        html_url: "https://example.test/pr/146",
        state: "open",
        draft: true,
        user: { login: "andreame-code" },
        base: { ref: "main" },
        head: { ref: "codex/pr-readiness-gate-20260423", sha: "sha-146" },
        labels: [{ name: "codex" }],
        additions: 24,
        deletions: 4,
        changed_files: 2,
        mergeable: true,
        mergeable_state: "clean"
      },
      "GET /repos/andreame-code/netrisk/commits/sha-146": {
        commit: {
          committer: {
            date: "2026-04-23T10:09:00.000Z"
          }
        }
      },
      "GET /repos/andreame-code/netrisk/compare/main...sha-146": {
        behind_by: 0,
        ahead_by: 2,
        status: "ahead",
        html_url: "https://example.test/compare"
      },
      "GET /repos/andreame-code/netrisk/actions/runs?head_sha=sha-146&per_page=100&page=1": {
        workflow_runs: [
          { id: 900, name: "Quality", head_sha: "sha-146" },
          { id: 901, name: "Coverage", head_sha: "sha-146" }
        ]
      },
      "GET /repos/andreame-code/netrisk/actions/runs?head_sha=sha-146&per_page=100&page=2": {
        workflow_runs: []
      },
      "GET /repos/andreame-code/netrisk/actions/runs/900/jobs?per_page=100": {
        jobs: [
          {
            id: 9001,
            name: "quality",
            html_url: "https://example.test/jobs/9001",
            status: "completed",
            conclusion: "success",
            started_at: "2026-04-23T10:10:00.000Z",
            completed_at: "2026-04-23T10:12:00.000Z",
            steps: [{ name: "Run build", status: "completed", conclusion: "success" }]
          }
        ]
      },
      "GET /repos/andreame-code/netrisk/actions/runs/901/jobs?per_page=100": {
        jobs: [
          {
            id: 9002,
            name: "coverage",
            html_url: "https://example.test/jobs/9002",
            status: "completed",
            conclusion: "success",
            started_at: "2026-04-23T10:12:00.000Z",
            completed_at: "2026-04-23T10:14:00.000Z",
            steps: []
          }
        ]
      },
      "GET /repos/andreame-code/netrisk/pulls/146/reviews?per_page=100&page=1": [
        {
          user: { login: "chatgpt-codex-connector" },
          state: "APPROVED",
          body: "Codex greenlight",
          submitted_at: "2026-04-23T10:15:00.000Z",
          html_url: "https://example.test/reviews/1"
        }
      ],
      "GET /repos/andreame-code/netrisk/pulls/146/reviews?per_page=100&page=2": [],
      "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
        {
          user: { login: "chatgpt-codex-connector" },
          body: "Codex PR readiness: greenlight",
          created_at: "2026-04-23T10:16:00.000Z",
          html_url: "https://example.test/comments/1"
        },
        {
          user: { login: "chatgpt-codex-connector" },
          body: "### Summary\n* Applied the requested fix.\n\n[View task ->](https://example.test/codex/tasks/1)",
          created_at: "2026-04-23T10:18:00.000Z",
          html_url: "https://example.test/comments/2"
        },
        {
          user: { login: "chatgpt-codex-connector" },
          body: "### Summary\n* Fixed the parser, preventing passive wording like could not be fixed from being misclassified.\n\n[View task ->](https://example.test/codex/tasks/2)",
          created_at: "2026-04-23T10:19:00.000Z",
          html_url: "https://example.test/comments/3"
        },
        {
          user: { login: "chatgpt-codex-connector" },
          body: "### Summary\n* Updated findings: one issue could not be fixed without a follow-up change.\n\n[View task ->](https://example.test/codex/tasks/3)",
          created_at: "2026-04-23T10:20:00.000Z",
          html_url: "https://example.test/comments/4"
        },
        {
          user: { login: "chatgpt-codex-connector" },
          body: "### Summary\n* Added regression coverage, but could not resolve the failing case.\n\n[View task ->](https://example.test/codex/tasks/4)",
          created_at: "2026-04-23T10:21:00.000Z",
          html_url: "https://example.test/comments/5"
        }
      ],
      "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=2": [],
      "GET /repos/andreame-code/netrisk/pulls/146/files?per_page=100&page=1": [
        {
          filename: "scripts/evaluate-codex-pr-readiness.cts",
          status: "modified",
          additions: 12,
          deletions: 1,
          changes: 13,
          patch: "@@ -1,1 +1,2 @@\n+export const ready = true;\n+export const applied = true;"
        }
      ],
      "GET /repos/andreame-code/netrisk/pulls/146/files?per_page=100&page=2": []
    },
    async () => ({
      repository: {
        pullRequest: {
          comments: {
            pageInfo: {
              hasNextPage: false,
              endCursor: null
            },
            nodes: [
              {
                url: "https://example.test/comments/1",
                isMinimized: false
              },
              {
                url: "https://example.test/comments/2",
                isMinimized: true
              },
              {
                url: "https://example.test/comments/3",
                isMinimized: true
              },
              {
                url: "https://example.test/comments/4",
                isMinimized: false
              },
              {
                url: "https://example.test/comments/5",
                isMinimized: false
              }
            ]
          },
          reviewThreads: {
            pageInfo: {
              hasNextPage: false,
              endCursor: null
            },
            nodes: [
              {
                id: "thread-1",
                isResolved: false,
                isOutdated: false,
                comments: {
                  nodes: [
                    {
                      author: { login: "chatgpt-codex-connector" },
                      body: "Please rerun coverage after the last push.",
                      createdAt: "2026-04-23T10:17:00.000Z",
                      url: "https://example.test/thread/1"
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    })
  );

  const snapshot = await getSnapshot(client, 146, config);

  assert.equal(snapshot.pr.headCommitAt, "2026-04-23T10:09:00.000Z");
  assert.equal(snapshot.branchFreshness.behindBy, 0);
  assert.equal(snapshot.workflowJobs.length, 2);
  assert.equal(snapshot.workflowJobs[0].workflowName, "Quality");
  assert.equal(snapshot.reviewThreads[0].comments[0].authorLogin, "chatgpt-codex-connector");
  assert.equal(snapshot.codexSignals.length, 4);
  assert.equal(
    snapshot.codexSignals.some((signal: { body: string }) =>
      signal.body.includes("Applied the requested fix")
    ),
    false
  );
  assert.equal(
    snapshot.codexSignals.some((signal: { body: string }) =>
      signal.body.includes("preventing passive wording")
    ),
    false
  );
  assert.equal(
    snapshot.codexSignals.some((signal: { body: string }) =>
      signal.body.includes("could not be fixed")
    ),
    true
  );
  assert.equal(
    snapshot.codexSignals.some((signal: { body: string }) =>
      signal.body.includes("could not resolve")
    ),
    true
  );
  assert.equal(snapshot.changedFiles[0].path, "scripts/evaluate-codex-pr-readiness.cts");
});

register("codex PR readiness upserts a single sticky summary comment", async () => {
  const createdClient = createFakeClient({
    "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [],
    "POST /repos/andreame-code/netrisk/issues/146/comments": {}
  });
  assert.equal(
    await upsertSummaryComment(
      createdClient,
      146,
      `${config.summaryCommentMarker}\nCreated summary`,
      config.summaryCommentMarker
    ),
    "created"
  );

  const updatedClient = createFakeClient({
    "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
      {
        id: 7,
        user: { login: "github-actions[bot]" },
        body: `${config.summaryCommentMarker}\nOld summary`
      }
    ],
    "PATCH /repos/andreame-code/netrisk/issues/comments/7": {}
  });
  assert.equal(
    await upsertSummaryComment(
      updatedClient,
      146,
      `${config.summaryCommentMarker}\nUpdated summary`,
      config.summaryCommentMarker
    ),
    "updated"
  );

  const patUpdatedClient = createFakeClient(
    {
      "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
        {
          id: 17,
          user: { login: "andreame-code" },
          body: `${config.summaryCommentMarker}\nOld PAT summary`
        }
      ],
      "PATCH /repos/andreame-code/netrisk/issues/comments/17": {}
    },
    undefined,
    "andreame-code"
  );
  assert.equal(
    await upsertSummaryComment(
      patUpdatedClient,
      146,
      `${config.summaryCommentMarker}\nUpdated PAT summary`,
      config.summaryCommentMarker
    ),
    "updated"
  );

  const crossAuthorClient = createFakeClient(
    {
      "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
        {
          id: 18,
          user: { login: "github-actions[bot]" },
          body: `${config.summaryCommentMarker}\nBot summary`
        }
      ],
      "POST /repos/andreame-code/netrisk/issues/146/comments": {}
    },
    undefined,
    "andreame-code"
  );
  assert.equal(
    await upsertSummaryComment(
      crossAuthorClient,
      146,
      `${config.summaryCommentMarker}\nNew PAT summary`,
      config.summaryCommentMarker
    ),
    "created"
  );

  const unchangedClient = createFakeClient({
    "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
      {
        id: 8,
        user: { login: "github-actions[bot]" },
        body: `${config.summaryCommentMarker}\nSame summary`
      }
    ]
  });
  assert.equal(
    await upsertSummaryComment(
      unchangedClient,
      146,
      `${config.summaryCommentMarker}\nSame summary`,
      config.summaryCommentMarker
    ),
    "unchanged"
  );
});

register("codex PR readiness applies draft transitions only for fully ready PRs", async () => {
  const readySnapshot = createSnapshot();
  const readyEvaluation = evaluateReadinessFromSnapshot(readySnapshot, config);
  const readyClient = createFakeClient(
    {
      "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [
        {
          id: 9,
          user: { login: "github-actions[bot]" },
          body: readyEvaluation.summary
        }
      ]
    },
    async () => ({
      markPullRequestReadyForReview: {
        pullRequest: {
          id: readySnapshot.pr.nodeId,
          isDraft: false
        }
      }
    })
  );

  assert.deepEqual(
    await applyEvaluation(readyClient, readySnapshot, readyEvaluation, config, true),
    {
      commentStatus: "unchanged",
      markedReady: true
    }
  );

  const pendingChecksEvaluation = {
    ...readyEvaluation,
    checkStatuses: readyEvaluation.checkStatuses.map((status: { status: string }, index: number) =>
      index === 0 ? { ...status, status: "pending", details: "Still running." } : status
    )
  };
  assert.deepEqual(
    await applyEvaluation(readyClient, readySnapshot, pendingChecksEvaluation, config, true),
    {
      commentStatus: "unchanged",
      markedReady: false
    }
  );

  const missingCodexOkEvaluation = {
    ...readyEvaluation,
    codexGreenlight: null,
    latestCodexSignal: {
      actorLogin: "chatgpt-codex-connector",
      state: "COMMENTED",
      body: `Implementation plan for ${readySnapshot.pr.headSha}`,
      submittedAt: "2026-04-23T10:11:00.000Z",
      url: "https://example.test/codex-plan",
      kind: "issue-comment"
    }
  };
  assert.deepEqual(
    await applyEvaluation(readyClient, readySnapshot, missingCodexOkEvaluation, config, true),
    {
      commentStatus: "unchanged",
      markedReady: false
    }
  );

  const blockedSnapshot = createSnapshot({
    reviewThreads: [
      {
        id: "thread-blocking",
        isResolved: false,
        isOutdated: false,
        comments: [
          {
            authorLogin: "chatgpt-codex-connector",
            body: "Still blocked",
            createdAt: "2026-04-23T10:30:00.000Z",
            url: "https://example.test/thread/blocking"
          }
        ]
      }
    ]
  });
  const blockedEvaluation = evaluateReadinessFromSnapshot(blockedSnapshot, config);
  const blockedClient = createFakeClient({
    "GET /repos/andreame-code/netrisk/issues/146/comments?per_page=100&page=1": [],
    "POST /repos/andreame-code/netrisk/issues/146/comments": {}
  });

  assert.deepEqual(
    await applyEvaluation(blockedClient, blockedSnapshot, blockedEvaluation, config, true),
    {
      commentStatus: "created",
      markedReady: false
    }
  );

  assert.deepEqual(
    await applyEvaluation(readyClient, readySnapshot, readyEvaluation, config, false),
    {
      commentStatus: "skipped",
      markedReady: false
    }
  );
});

register("codex PR readiness builds batch summaries for empty and populated runs", () => {
  assert.match(
    buildBatchSummary([]),
    new RegExp(escapeForRegExp("No targeted draft PRs were evaluated in this run."))
  );

  assert.match(
    buildBatchSummary([
      {
        pr: createSnapshot().pr,
        evaluation: {
          ...evaluateReadinessFromSnapshot(createSnapshot(), config),
          blockers: [],
          advisories: [{ code: "large-diff", message: "Large diff." }]
        },
        applyResult: {
          commentStatus: "updated",
          markedReady: true
        }
      }
    ]),
    new RegExp(
      escapeForRegExp(
        "PR #146: READY (0 blocker(s), 1 advisory/advisories, comment updated, marked ready yes)"
      )
    )
  );
});

register(
  "codex PR readiness GitHub client handles REST and GraphQL success and failures",
  async () => {
    assert.throws(
      () => new GitHubApiClient("invalid-repo-value", "token"),
      /Invalid repository value/
    );

    const originalFetch = global.fetch;
    const calls: Array<Record<string, unknown>> = [];

    try {
      global.fetch = (async (url: string, init: Record<string, unknown>) => {
        calls.push({
          url,
          method: init.method
        });

        if (String(url).endsWith("/user")) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { login: "andreame-code" };
            },
            async text() {
              return "";
            }
          } as any;
        }

        if (String(url).endsWith("/ok")) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { ok: true };
            },
            async text() {
              return "";
            }
          } as any;
        }

        if (String(url).endsWith("/empty")) {
          return {
            ok: true,
            status: 204,
            async json() {
              return null;
            },
            async text() {
              return "";
            }
          } as any;
        }

        if (String(url).endsWith("/graphql")) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  viewer: {
                    login: "chatgpt-codex-connector"
                  }
                }
              };
            },
            async text() {
              return "";
            }
          } as any;
        }

        return {
          ok: false,
          status: 500,
          async json() {
            return {};
          },
          async text() {
            return "boom";
          }
        } as any;
      }) as typeof global.fetch;

      const client = new GitHubApiClient("andreame-code/netrisk", "token");
      assert.deepEqual(await client.requestJson("GET", "/ok"), { ok: true });
      assert.equal(await client.requestJson("POST", "/empty"), null);
      assert.deepEqual(await client.graphql("query Viewer { viewer { login } }", {}), {
        viewer: {
          login: "chatgpt-codex-connector"
        }
      });
      assert.equal(await client.getAuthenticatedLogin(), "andreame-code");

      const originalActor = process.env.GITHUB_ACTOR;
      process.env.GITHUB_ACTOR = "andreame-code";
      const successfulFetch = global.fetch;
      try {
        global.fetch = (async () =>
          ({
            ok: false,
            status: 500,
            async json() {
              return {};
            },
            async text() {
              return "lookup failed";
            }
          }) as any) as typeof global.fetch;
        const fallbackClient = new GitHubApiClient("andreame-code/netrisk", "token");
        assert.equal(await fallbackClient.getAuthenticatedLogin(), "github-actions[bot]");
      } finally {
        global.fetch = successfulFetch;
        if (originalActor === undefined) {
          delete process.env.GITHUB_ACTOR;
        } else {
          process.env.GITHUB_ACTOR = originalActor;
        }
      }

      let transientAttempts = 0;
      try {
        global.fetch = (async () => {
          transientAttempts += 1;
          if (transientAttempts === 1) {
            return {
              ok: false,
              status: 500,
              async json() {
                return {};
              },
              async text() {
                return "temporary lookup failure";
              }
            } as any;
          }

          return {
            ok: true,
            status: 200,
            async json() {
              return { login: "andreame-code" };
            },
            async text() {
              return "";
            }
          } as any;
        }) as typeof global.fetch;
        const transientClient = new GitHubApiClient("andreame-code/netrisk", "token");
        assert.equal(await transientClient.getAuthenticatedLogin(), "github-actions[bot]");
        assert.equal(await transientClient.getAuthenticatedLogin(), "andreame-code");
      } finally {
        global.fetch = successfulFetch;
      }
      await assert.rejects(
        async () => client.requestJson("GET", "/fail"),
        /GET \/fail failed \(500\): boom/
      );
    } finally {
      global.fetch = originalFetch;
    }

    const graphqlFailureFetch = global.fetch;
    try {
      global.fetch = (async () =>
        ({
          ok: true,
          status: 200,
          async json() {
            return {
              errors: [{ message: "GraphQL exploded" }]
            };
          },
          async text() {
            return "";
          }
        }) as any) as typeof global.fetch;

      const client = new GitHubApiClient("andreame-code/netrisk", "token");
      await assert.rejects(
        async () => client.graphql("query Viewer { viewer { login } }", {}),
        /GraphQL returned errors: GraphQL exploded/
      );
    } finally {
      global.fetch = graphqlFailureFetch;
    }

    assert.equal(calls.length >= 4, true);
  }
);

function escapeForRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
