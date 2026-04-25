const fs = require("node:fs");
const path = require("node:path");

type QualityStepGroupName = "typecheck" | "build" | "lint" | "format" | "reactTests";
type PullRequestDecision = "ready" | "blocked" | "skipped";
type ApplyCommentStatus = "created" | "updated" | "unchanged" | "skipped";
type AllowlistEntry = {
  pattern: string;
  markers?: string[];
};

type SyncRequirement = {
  ifChanged: string[];
  mustAlsoChange: string[];
  message: string;
};

type GateConfig = {
  targetLabel: string;
  branchPrefix: string;
  codexActors: string[];
  codexGreenlightPhrases: string[];
  requiredCheckNames: string[];
  requiredQualitySteps: Record<QualityStepGroupName, string[]>;
  maxCommitsBehindBase: number;
  summaryCommentMarker: string;
  skipTestAllowlist: AllowlistEntry[];
  temporaryMarkerAllowlist: AllowlistEntry[];
  syncRequirements: SyncRequirement[];
  productionFileGlobs: string[];
  testFileGlobs: string[];
  docFileGlobs: string[];
  largeDiffChangeThreshold: number;
  significantChangeThreshold: number;
  lowTestAdditionsMinProductionAdditions: number;
  lowTestAdditionsRatio: number;
};

type GitHubRepositoryRef = {
  owner: string;
  repo: string;
};

type PullRequestSummary = {
  number: number;
  nodeId: string;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  authorLogin: string;
  baseRefName: string;
  headRefName: string;
  headSha: string;
  headCommitAt: string;
  labels: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: boolean | null;
  mergeableState: string | null;
};

type WorkflowJobStep = {
  name: string;
  status: string | null;
  conclusion: string | null;
};

type WorkflowJob = {
  id: number;
  name: string;
  htmlUrl: string;
  status: string | null;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  workflowName: string;
  steps: WorkflowJobStep[];
};

type ReviewThreadComment = {
  authorLogin: string;
  body: string;
  createdAt: string;
  url: string;
};

type ReviewThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  comments: ReviewThreadComment[];
};

type ReviewSignal = {
  actorLogin: string;
  state: string | null;
  body: string;
  submittedAt: string;
  url: string;
  kind: "review" | "issue-comment";
};

type ChangedFile = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
};

type BranchFreshness = {
  behindBy: number;
  aheadBy: number;
  status: string;
  url: string;
};

type Snapshot = {
  pr: PullRequestSummary;
  branchFreshness: BranchFreshness;
  workflowJobs: WorkflowJob[];
  reviewThreads: ReviewThread[];
  codexSignals: ReviewSignal[];
  changedFiles: ChangedFile[];
};

type ReviewThreadsQueryData = {
  repository?: {
    pullRequest?: {
      reviewThreads?: {
        pageInfo?: ReviewThreadsPageInfo;
        nodes?: any[];
      };
    };
  };
};

type ReviewThreadsPageInfo = {
  hasNextPage?: boolean;
  endCursor?: string | null;
};

type GateMessage = {
  code: string;
  message: string;
};

type CheckStatusRow = {
  name: string;
  status: string;
  details: string;
};

type QualityGroupStatus = {
  name: QualityStepGroupName;
  status: "pass" | "fail" | "pending" | "missing";
  details: string;
};

type ReadinessEvaluation = {
  decision: PullRequestDecision;
  targeted: boolean;
  targetReason: string | null;
  blockers: GateMessage[];
  advisories: GateMessage[];
  checkStatuses: CheckStatusRow[];
  qualityStatuses: QualityGroupStatus[];
  unresolvedReviewThreads: number;
  unresolvedCodexThreads: number;
  branchFreshness: BranchFreshness;
  codexGreenlight: ReviewSignal | null;
  latestCodexSignal: ReviewSignal | null;
  summary: string;
};

type ApplyResult = {
  commentStatus: ApplyCommentStatus;
  markedReady: boolean;
};

type EvaluationResult = {
  pr: PullRequestSummary;
  evaluation: ReadinessEvaluation;
  applyResult: ApplyResult;
};

type GitHubPullRequestListItem = {
  number: number;
  draft: boolean;
  state: string;
  labels?: Array<{ name?: string }>;
  user?: { login?: string };
  base?: { ref?: string };
  head?: { ref?: string; sha?: string };
};

type CommandOptions = {
  apply: boolean;
  configPath: string | null;
  eventPath: string | null;
  repository: string | null;
  prNumbers: number[];
  jsonOutputPath: string | null;
  summaryOutputPath: string | null;
};

const READY_COMMENT_HEADING = "## Codex PR Readiness Gate";
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), ".github", "codex-pr-readiness.json");
const SUCCESS_CONCLUSION = "success";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  let source = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*") {
      if (normalized[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }

    source += escapeRegExp(character);
  }

  return new RegExp(`^${source}$`);
}

function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalizedPath));
}

function loadGateConfig(configPath: string = DEFAULT_CONFIG_PATH): GateConfig {
  return readJsonFile<GateConfig>(configPath);
}

function normalizeBody(body: string): string {
  return String(body || "")
    .trim()
    .toLowerCase();
}

function isCodexActor(login: string, config: GateConfig): boolean {
  return config.codexActors.includes(String(login || "").trim());
}

function isTargetPullRequest(
  pr: PullRequestSummary,
  config: GateConfig
): {
  targeted: boolean;
  reason: string | null;
} {
  if (pr.state !== "open") {
    return { targeted: false, reason: null };
  }

  if (!pr.isDraft) {
    return { targeted: false, reason: null };
  }

  if (pr.labels.includes(config.targetLabel)) {
    return { targeted: true, reason: `label \`${config.targetLabel}\`` };
  }

  if (pr.headRefName.startsWith(config.branchPrefix)) {
    return { targeted: true, reason: `branch prefix \`${config.branchPrefix}\`` };
  }

  if (isCodexActor(pr.authorLogin, config)) {
    return { targeted: true, reason: `author \`${pr.authorLogin}\`` };
  }

  return { targeted: false, reason: null };
}

function parseAddedLines(patch: string | null): string[] {
  if (!patch) {
    return [];
  }

  return String(patch)
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function isAllowlisted(filePath: string, marker: string, entries: AllowlistEntry[]): boolean {
  return entries.some((entry) => {
    if (!matchesAnyGlob(filePath, [entry.pattern])) {
      return false;
    }

    const markers = asArray(entry.markers);
    if (!markers.length) {
      return true;
    }

    return markers.includes(marker);
  });
}

function summarizeFileMatches(
  prefix: string,
  matches: Array<{ path: string; marker: string }>
): string {
  const grouped = new Map<string, Set<string>>();
  matches.forEach((match) => {
    if (!grouped.has(match.path)) {
      grouped.set(match.path, new Set<string>());
    }
    grouped.get(match.path)?.add(match.marker);
  });

  const parts = Array.from(grouped.entries()).map(
    ([filePath, markers]) => `\`${filePath}\` (${Array.from(markers).join(", ")})`
  );
  return `${prefix}: ${parts.join("; ")}`;
}

function collectSkippedTestMatches(changedFiles: ChangedFile[], config: GateConfig) {
  const skipPattern = /\b(?:it|test|describe)\.skip\s*\(/;
  const matches: Array<{ path: string; marker: string }> = [];

  changedFiles.forEach((file) => {
    if (!matchesAnyGlob(file.path, config.testFileGlobs)) {
      return;
    }

    parseAddedLines(file.patch).forEach((line) => {
      if (!skipPattern.test(line)) {
        return;
      }

      const marker = line.match(/\b(?:it|test|describe)\.skip\b/)?.[0] || "skip";
      if (isAllowlisted(file.path, marker, config.skipTestAllowlist)) {
        return;
      }

      matches.push({ path: file.path, marker });
    });
  });

  return matches;
}

function collectTemporaryMarkerMatches(changedFiles: ChangedFile[], config: GateConfig) {
  const markerRules: Array<{ marker: string; regex: RegExp }> = [
    { marker: "console.log", regex: /\bconsole\.log\s*\(/ },
    { marker: "debugger", regex: /\bdebugger\b/ },
    { marker: "TODO", regex: /\bTODO\b/i },
    { marker: "FIXME", regex: /\bFIXME\b/i },
    { marker: "temporary", regex: /\btemporary\b/i },
    { marker: "placeholder", regex: /\bplaceholder\b/i },
    { marker: "mock-marker", regex: /(?:\/\/|\/\*|\*|#).*\bmock\b/i }
  ];
  const matches: Array<{ path: string; marker: string }> = [];

  changedFiles.forEach((file) => {
    parseAddedLines(file.patch).forEach((line) => {
      markerRules.forEach((rule) => {
        if (!rule.regex.test(line)) {
          return;
        }

        if (isAllowlisted(file.path, rule.marker, config.temporaryMarkerAllowlist)) {
          return;
        }

        matches.push({ path: file.path, marker: rule.marker });
      });
    });
  });

  return matches;
}

function collectSyncBlockers(changedFiles: ChangedFile[], config: GateConfig): GateMessage[] {
  return config.syncRequirements
    .filter((requirement) =>
      changedFiles.some((file) => matchesAnyGlob(file.path, requirement.ifChanged))
    )
    .filter(
      (requirement) =>
        !requirement.mustAlsoChange.every((expected) =>
          changedFiles.some((file) => matchesAnyGlob(file.path, [expected]))
        )
    )
    .map((requirement, index) => ({
      code: `sync-requirement-${index + 1}`,
      message: requirement.message
    }));
}

function latestWorkflowJobByName(workflowJobs: WorkflowJob[], jobName: string): WorkflowJob | null {
  return (
    workflowJobs
      .filter((job) => job.name === jobName)
      .sort((left, right) => {
        const leftDate = Date.parse(left.completedAt || left.startedAt || "");
        const rightDate = Date.parse(right.completedAt || right.startedAt || "");
        return rightDate - leftDate;
      })[0] || null
  );
}

function describeJobStatus(job: WorkflowJob | null): CheckStatusRow {
  if (!job) {
    return {
      name: "missing",
      status: "missing",
      details: "No matching workflow job was found for the current head SHA."
    };
  }

  if (job.status !== "completed") {
    return {
      name: job.name,
      status: "pending",
      details: "The job is still running or queued."
    };
  }

  return {
    name: job.name,
    status: job.conclusion === SUCCESS_CONCLUSION ? "pass" : "fail",
    details: `Conclusion: ${String(job.conclusion || "unknown")}.`
  };
}

function evaluateCheckStatuses(
  snapshot: Snapshot,
  config: GateConfig
): {
  blockers: GateMessage[];
  checkStatuses: CheckStatusRow[];
} {
  const blockers: GateMessage[] = [];
  const checkStatuses: CheckStatusRow[] = [];

  config.requiredCheckNames.forEach((checkName) => {
    const job = latestWorkflowJobByName(snapshot.workflowJobs, checkName);
    const statusRow = describeJobStatus(job);
    statusRow.name = checkName;
    checkStatuses.push(statusRow);

    if (!job) {
      blockers.push({
        code: `required-check-missing:${checkName}`,
        message: `Required check \`${checkName}\` is missing for the current head SHA.`
      });
      return;
    }

    if (job.status !== "completed") {
      blockers.push({
        code: `required-check-pending:${checkName}`,
        message: `Required check \`${checkName}\` is still pending.`
      });
      return;
    }

    if (job.conclusion !== SUCCESS_CONCLUSION) {
      blockers.push({
        code: `required-check-failed:${checkName}`,
        message: `Required check \`${checkName}\` finished with \`${String(
          job.conclusion || "unknown"
        )}\`.`
      });
    }
  });

  return { blockers, checkStatuses };
}

function evaluateQualitySteps(
  snapshot: Snapshot,
  config: GateConfig
): {
  blockers: GateMessage[];
  qualityStatuses: QualityGroupStatus[];
} {
  const blockers: GateMessage[] = [];
  const qualityStatuses: QualityGroupStatus[] = [];
  const qualityJob = latestWorkflowJobByName(snapshot.workflowJobs, "quality");

  (Object.keys(config.requiredQualitySteps) as QualityStepGroupName[]).forEach((groupName) => {
    const expectedSteps = config.requiredQualitySteps[groupName];

    if (!qualityJob) {
      qualityStatuses.push({
        name: groupName,
        status: "missing",
        details: "The quality job is missing, so this requirement could not be verified."
      });
      blockers.push({
        code: `quality-group-missing:${groupName}`,
        message: `Cannot verify the \`${groupName}\` readiness requirement because the \`quality\` job is missing.`
      });
      return;
    }

    const matchingSteps = expectedSteps.map(
      (stepName) => qualityJob.steps.find((step) => step.name === stepName) || null
    );
    if (matchingSteps.some((step) => !step)) {
      qualityStatuses.push({
        name: groupName,
        status: "missing",
        details: `Expected quality steps not found: ${expectedSteps.join(", ")}.`
      });
      blockers.push({
        code: `quality-step-missing:${groupName}`,
        message: `Cannot verify \`${groupName}\` because one or more expected quality steps are missing: ${expectedSteps.join(
          ", "
        )}.`
      });
      return;
    }

    const pendingStep = matchingSteps.find((step) => step?.status !== "completed");
    if (pendingStep) {
      qualityStatuses.push({
        name: groupName,
        status: "pending",
        details: `Quality step \`${pendingStep.name}\` is still pending.`
      });
      blockers.push({
        code: `quality-step-pending:${groupName}`,
        message: `Quality step \`${pendingStep.name}\` is still pending.`
      });
      return;
    }

    const failedSteps = matchingSteps.filter((step) => step?.conclusion !== SUCCESS_CONCLUSION);
    if (failedSteps.length > 0) {
      qualityStatuses.push({
        name: groupName,
        status: "fail",
        details: `Failing quality steps: ${failedSteps
          .map((step) => `${step?.name} (${String(step?.conclusion || "unknown")})`)
          .join(", ")}.`
      });
      blockers.push({
        code: `quality-step-failed:${groupName}`,
        message: `The \`${groupName}\` readiness requirement failed in ${failedSteps
          .map((step) => `\`${step?.name}\``)
          .join(", ")}.`
      });
      return;
    }

    qualityStatuses.push({
      name: groupName,
      status: "pass",
      details: `Verified via ${expectedSteps.join(", ")}.`
    });
  });

  return { blockers, qualityStatuses };
}

function latestSignal(signals: ReviewSignal[]): ReviewSignal | null {
  return (
    [...signals].sort(
      (left, right) => Date.parse(right.submittedAt || "") - Date.parse(left.submittedAt || "")
    )[0] || null
  );
}

function isGreenlightSignal(signal: ReviewSignal, config: GateConfig): boolean {
  if (signal.kind === "review" && signal.state === "APPROVED") {
    return true;
  }

  const body = normalizeBody(signal.body);
  return config.codexGreenlightPhrases.some((phrase) => body.includes(normalizeBody(phrase)));
}

function evaluateCodexSignals(
  snapshot: Snapshot,
  config: GateConfig
): {
  blockers: GateMessage[];
  unresolvedReviewThreads: number;
  unresolvedCodexThreads: number;
  codexGreenlight: ReviewSignal | null;
  latestCodexSignal: ReviewSignal | null;
} {
  const blockers: GateMessage[] = [];
  const unresolvedThreads = snapshot.reviewThreads.filter((thread) => !thread.isResolved);
  const unresolvedReviewThreads = unresolvedThreads.length;
  const unresolvedCodexThreads = unresolvedThreads.filter((thread) =>
    thread.comments.some((comment) => isCodexActor(comment.authorLogin, config))
  ).length;
  const postHeadSignals = snapshot.codexSignals.filter(
    (signal) => Date.parse(signal.submittedAt || "") >= Date.parse(snapshot.pr.headCommitAt || "")
  );
  const latestCodexSignal = latestSignal(postHeadSignals);
  const codexGreenlight =
    postHeadSignals
      .filter((signal) => isGreenlightSignal(signal, config))
      .sort(
        (left, right) => Date.parse(right.submittedAt || "") - Date.parse(left.submittedAt || "")
      )[0] || null;

  if (unresolvedReviewThreads > 0) {
    blockers.push({
      code: "unresolved-review-threads",
      message: `${unresolvedReviewThreads} unresolved review thread(s) remain.`
    });
  }

  if (!latestCodexSignal) {
    blockers.push({
      code: "missing-codex-greenlight",
      message: `No explicit Codex greenlight was found after head commit \`${snapshot.pr.headSha.slice(
        0,
        12
      )}\`.`
    });
  } else if (!isGreenlightSignal(latestCodexSignal, config)) {
    blockers.push({
      code: "stale-codex-greenlight",
      message: "The latest Codex signal after the current head commit is not a final greenlight."
    });
  }

  return {
    blockers,
    unresolvedReviewThreads,
    unresolvedCodexThreads,
    codexGreenlight,
    latestCodexSignal
  };
}

function evaluateBranchFreshness(snapshot: Snapshot, config: GateConfig): GateMessage[] {
  if (snapshot.branchFreshness.behindBy <= config.maxCommitsBehindBase) {
    return [];
  }

  return [
    {
      code: "branch-stale",
      message: `The PR branch is ${snapshot.branchFreshness.behindBy} commit(s) behind \`${snapshot.pr.baseRefName}\`, which exceeds the freshness limit of ${config.maxCommitsBehindBase}.`
    }
  ];
}

function evaluateMergeability(snapshot: Snapshot): GateMessage[] {
  if (snapshot.pr.mergeable === true) {
    return [];
  }

  return [
    {
      code: "not-mergeable",
      message: `GitHub reports the PR as not mergeable (${String(
        snapshot.pr.mergeableState || "unknown"
      )}).`
    }
  ];
}

function buildAdvisories(snapshot: Snapshot, config: GateConfig): GateMessage[] {
  const advisories: GateMessage[] = [];
  const changedFiles = snapshot.changedFiles.filter((file) => file.status !== "removed");
  const productionFiles = changedFiles.filter((file) =>
    matchesAnyGlob(file.path, config.productionFileGlobs)
  );
  const testFiles = changedFiles.filter((file) => matchesAnyGlob(file.path, config.testFileGlobs));
  const docFiles = changedFiles.filter((file) => matchesAnyGlob(file.path, config.docFileGlobs));
  const totalChanges = changedFiles.reduce((sum, file) => sum + Number(file.changes || 0), 0);
  const productionAdditions = productionFiles.reduce(
    (sum, file) => sum + Number(file.additions || 0),
    0
  );
  const testAdditions = testFiles.reduce((sum, file) => sum + Number(file.additions || 0), 0);

  if (totalChanges >= config.largeDiffChangeThreshold) {
    advisories.push({
      code: "large-diff",
      message: `The diff is large (${totalChanges} changed lines across ${changedFiles.length} files).`
    });
  }

  if (productionAdditions >= config.significantChangeThreshold && docFiles.length === 0) {
    advisories.push({
      code: "missing-docs",
      message: "Significant production changes were detected without corresponding docs updates."
    });
  }

  const backendOrSharedTouched = productionFiles.some((file) =>
    matchesAnyGlob(file.path, ["backend/**", "shared/**", "scripts/**", "api/**", "supabase/**"])
  );
  const frontendTouched = productionFiles.some((file) =>
    matchesAnyGlob(file.path, ["frontend/**", "frontend/react-shell/**"])
  );

  if (
    backendOrSharedTouched &&
    !testFiles.some((file) => matchesAnyGlob(file.path, ["tests/**"]))
  ) {
    advisories.push({
      code: "coverage-risk-backend",
      message:
        "Backend/shared production changes were detected without matching automated test file updates."
    });
  }

  if (
    frontendTouched &&
    !testFiles.some((file) =>
      matchesAnyGlob(file.path, ["frontend/react-shell/src/__tests__/**", "e2e/**", "tests/**"])
    )
  ) {
    advisories.push({
      code: "coverage-risk-frontend",
      message:
        "Frontend production changes were detected without matching React or E2E test updates."
    });
  }

  if (
    productionAdditions >= config.lowTestAdditionsMinProductionAdditions &&
    testAdditions < Math.max(1, Math.floor(productionAdditions * config.lowTestAdditionsRatio))
  ) {
    advisories.push({
      code: "low-test-additions",
      message: `Production additions (${productionAdditions}) substantially exceed new test additions (${testAdditions}).`
    });
  }

  return advisories;
}

function buildSummary(
  pr: PullRequestSummary,
  evaluation: ReadinessEvaluation,
  config: GateConfig
): string {
  const lines = [
    config.summaryCommentMarker,
    READY_COMMENT_HEADING,
    "",
    `Decision: **${evaluation.decision === "ready" ? "READY" : "BLOCKED"}**`,
    "",
    `- PR: #${pr.number} - ${pr.title}`,
    `- Target reason: ${evaluation.targetReason || "n/a"}`,
    `- Head branch: \`${pr.headRefName}\``,
    `- Base branch: \`${pr.baseRefName}\``,
    `- Mergeable: ${pr.mergeable === true ? "yes" : `no (${String(pr.mergeableState || "unknown")})`}`,
    `- Branch freshness: ${evaluation.branchFreshness.behindBy} commit(s) behind \`${pr.baseRefName}\``,
    `- Unresolved review threads: ${evaluation.unresolvedReviewThreads}`,
    `- Unresolved Codex review threads: ${evaluation.unresolvedCodexThreads}`,
    `- Codex greenlight: ${
      evaluation.codexGreenlight
        ? `yes (${evaluation.codexGreenlight.kind} by \`${evaluation.codexGreenlight.actorLogin}\`)`
        : "missing"
    }`,
    "",
    "### Hard blockers",
    ...(evaluation.blockers.length
      ? evaluation.blockers.map((blocker) => `- ${blocker.message}`)
      : ["- None."]),
    "",
    "### Soft advisories",
    ...(evaluation.advisories.length
      ? evaluation.advisories.map((advisory) => `- ${advisory.message}`)
      : ["- None."]),
    "",
    "### Required checks",
    ...evaluation.checkStatuses.map(
      (status) => `- \`${status.name}\`: ${status.status.toUpperCase()} - ${status.details}`
    ),
    "",
    "### Quality gate details",
    ...evaluation.qualityStatuses.map(
      (status) => `- \`${status.name}\`: ${status.status.toUpperCase()} - ${status.details}`
    ),
    "",
    evaluation.decision === "ready"
      ? "Final decision: **Ready for review.** The automation will mark this draft PR as ready."
      : "Final decision: **Keep in draft.** The automation will not mark this PR ready until every hard blocker is cleared."
  ];

  return lines.join("\n");
}

function evaluateReadinessFromSnapshot(
  snapshot: Snapshot,
  config: GateConfig
): ReadinessEvaluation {
  const targetInfo = isTargetPullRequest(snapshot.pr, config);
  if (!targetInfo.targeted) {
    return {
      decision: "skipped",
      targeted: false,
      targetReason: null,
      blockers: [],
      advisories: [],
      checkStatuses: [],
      qualityStatuses: [],
      unresolvedReviewThreads: 0,
      unresolvedCodexThreads: 0,
      branchFreshness: snapshot.branchFreshness,
      codexGreenlight: null,
      latestCodexSignal: null,
      summary: ""
    };
  }

  const blockers: GateMessage[] = [];
  const advisories = buildAdvisories(snapshot, config);
  const checkEvaluation = evaluateCheckStatuses(snapshot, config);
  const qualityEvaluation = evaluateQualitySteps(snapshot, config);
  const codexEvaluation = evaluateCodexSignals(snapshot, config);

  blockers.push(...checkEvaluation.blockers);
  blockers.push(...qualityEvaluation.blockers);
  blockers.push(...evaluateBranchFreshness(snapshot, config));
  blockers.push(...evaluateMergeability(snapshot));
  blockers.push(...codexEvaluation.blockers);

  const skippedTests = collectSkippedTestMatches(snapshot.changedFiles, config);
  if (skippedTests.length > 0) {
    blockers.push({
      code: "skipped-tests-introduced",
      message: summarizeFileMatches("New skipped tests were introduced", skippedTests)
    });
  }

  const temporaryMatches = collectTemporaryMarkerMatches(snapshot.changedFiles, config);
  if (temporaryMatches.length > 0) {
    blockers.push({
      code: "temporary-leftovers",
      message: summarizeFileMatches(
        "Temporary or debug leftovers were introduced",
        temporaryMatches
      )
    });
  }

  blockers.push(...collectSyncBlockers(snapshot.changedFiles, config));

  const decision: PullRequestDecision = blockers.length === 0 ? "ready" : "blocked";
  const evaluation: ReadinessEvaluation = {
    decision,
    targeted: true,
    targetReason: targetInfo.reason,
    blockers,
    advisories,
    checkStatuses: checkEvaluation.checkStatuses,
    qualityStatuses: qualityEvaluation.qualityStatuses,
    unresolvedReviewThreads: codexEvaluation.unresolvedReviewThreads,
    unresolvedCodexThreads: codexEvaluation.unresolvedCodexThreads,
    branchFreshness: snapshot.branchFreshness,
    codexGreenlight: codexEvaluation.codexGreenlight,
    latestCodexSignal: codexEvaluation.latestCodexSignal,
    summary: ""
  };

  evaluation.summary = buildSummary(snapshot.pr, evaluation, config);
  return evaluation;
}

function parseRepository(input: string): GitHubRepositoryRef {
  const [owner, repo] = String(input || "").split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository value "${input}". Expected owner/name.`);
  }

  return { owner, repo };
}

class GitHubApiClient {
  owner: string;
  repo: string;
  token: string;

  constructor(repository: string, token: string) {
    const parsed = parseRepository(repository);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    this.token = token;
  }

  async requestJson(method: string, requestPath: string, body?: Record<string, unknown>) {
    const response = await fetch(`https://api.github.com${requestPath}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "netrisk-codex-pr-readiness"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${requestPath} failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "netrisk-codex-pr-readiness"
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GraphQL request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new Error(
        `GraphQL returned errors: ${payload.errors.map((entry) => entry.message || "unknown").join("; ")}`
      );
    }

    return payload.data as T;
  }
}

async function paginateRest<T>(client: GitHubApiClient, requestPath: string): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const pagePath = `${requestPath}${requestPath.includes("?") ? "&" : "?"}per_page=100&page=${page}`;
    const pageResults = (await client.requestJson("GET", pagePath)) as T[];
    results.push(...asArray(pageResults));
    if (asArray(pageResults).length < 100) {
      break;
    }
  }
  return results;
}

function toPullRequestSummary(raw: any): PullRequestSummary {
  return {
    number: Number(raw.number || 0),
    nodeId: String(raw.node_id || ""),
    title: String(raw.title || ""),
    url: String(raw.html_url || ""),
    state: String(raw.state || ""),
    isDraft: Boolean(raw.draft),
    authorLogin: String(raw.user?.login || ""),
    baseRefName: String(raw.base?.ref || ""),
    headRefName: String(raw.head?.ref || ""),
    headSha: String(raw.head?.sha || ""),
    headCommitAt: "",
    labels: asArray(raw.labels)
      .map((label: any) => String(label?.name || ""))
      .filter(Boolean),
    additions: Number(raw.additions || 0),
    deletions: Number(raw.deletions || 0),
    changedFiles: Number(raw.changed_files || 0),
    mergeable: typeof raw.mergeable === "boolean" ? raw.mergeable : null,
    mergeableState: raw.mergeable_state ? String(raw.mergeable_state) : null
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPullRequest(
  client: GitHubApiClient,
  prNumber: number
): Promise<PullRequestSummary> {
  let attempt = 0;
  while (attempt < 4) {
    const raw = await client.requestJson(
      "GET",
      `/repos/${client.owner}/${client.repo}/pulls/${prNumber}`
    );
    const summary = toPullRequestSummary(raw);
    if (summary.mergeable !== null || attempt === 3) {
      return summary;
    }
    attempt += 1;
    await sleep(1500);
  }

  throw new Error(`Unable to load pull request #${prNumber}.`);
}

async function getHeadCommitTimestamp(client: GitHubApiClient, headSha: string): Promise<string> {
  const raw = (await client.requestJson(
    "GET",
    `/repos/${client.owner}/${client.repo}/commits/${headSha}`
  )) as any;
  return String(raw.commit?.committer?.date || raw.commit?.author?.date || "");
}

async function getBranchFreshness(
  client: GitHubApiClient,
  pr: PullRequestSummary
): Promise<BranchFreshness> {
  const raw = (await client.requestJson(
    "GET",
    `/repos/${client.owner}/${client.repo}/compare/${encodeURIComponent(pr.baseRefName)}...${encodeURIComponent(
      pr.headSha
    )}`
  )) as any;

  return {
    behindBy: Number(raw.behind_by || 0),
    aheadBy: Number(raw.ahead_by || 0),
    status: String(raw.status || "unknown"),
    url: String(raw.html_url || "")
  };
}

async function getWorkflowJobs(client: GitHubApiClient, headSha: string): Promise<WorkflowJob[]> {
  const runs: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const raw = (await client.requestJson(
      "GET",
      `/repos/${client.owner}/${client.repo}/actions/runs?head_sha=${encodeURIComponent(
        headSha
      )}&per_page=100&page=${page}`
    )) as { workflow_runs?: any[] };
    const pageRuns = asArray(raw.workflow_runs).filter(
      (run) => String(run.head_sha || "") === headSha
    );
    runs.push(...pageRuns);
    if (pageRuns.length < 100) {
      break;
    }
  }
  const jobs: WorkflowJob[] = [];

  for (const run of runs) {
    const jobsResponse = (await client.requestJson(
      "GET",
      `/repos/${client.owner}/${client.repo}/actions/runs/${run.id}/jobs?per_page=100`
    )) as { jobs?: any[] };
    asArray(jobsResponse.jobs).forEach((job) => {
      jobs.push({
        id: Number(job.id || 0),
        name: String(job.name || ""),
        htmlUrl: String(job.html_url || ""),
        status: job.status ? String(job.status) : null,
        conclusion: job.conclusion ? String(job.conclusion) : null,
        startedAt: job.started_at ? String(job.started_at) : null,
        completedAt: job.completed_at ? String(job.completed_at) : null,
        workflowName: String(run.name || ""),
        steps: asArray(job.steps).map((step: any) => ({
          name: String(step.name || ""),
          status: step.status ? String(step.status) : null,
          conclusion: step.conclusion ? String(step.conclusion) : null
        }))
      });
    });
  }

  const latestByName = new Map<string, WorkflowJob>();
  jobs.forEach((job) => {
    const existing = latestByName.get(job.name);
    if (!existing) {
      latestByName.set(job.name, job);
      return;
    }

    const existingTime = Date.parse(existing.completedAt || existing.startedAt || "");
    const nextTime = Date.parse(job.completedAt || job.startedAt || "");
    if (nextTime >= existingTime) {
      latestByName.set(job.name, job);
    }
  });

  return Array.from(latestByName.values());
}

async function getReviewThreads(
  client: GitHubApiClient,
  prNumber: number
): Promise<ReviewThread[]> {
  const threads: ReviewThread[] = [];
  let cursor: string | null = null;

  while (true) {
    const payload: ReviewThreadsQueryData = await client.graphql<ReviewThreadsQueryData>(
      `
        query ReviewThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              reviewThreads(first: 100, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  isResolved
                  isOutdated
                  comments(first: 20) {
                    nodes {
                      author {
                        login
                      }
                      body
                      createdAt
                      url
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        owner: client.owner,
        repo: client.repo,
        number: prNumber,
        cursor
      }
    );

    const reviewThreads = asArray(payload.repository?.pullRequest?.reviewThreads?.nodes).map(
      (thread: any) => ({
        id: String(thread.id || ""),
        isResolved: Boolean(thread.isResolved),
        isOutdated: Boolean(thread.isOutdated),
        comments: asArray(thread.comments?.nodes).map((comment: any) => ({
          authorLogin: String(comment.author?.login || ""),
          body: String(comment.body || ""),
          createdAt: String(comment.createdAt || ""),
          url: String(comment.url || "")
        }))
      })
    );

    threads.push(...reviewThreads);
    const pageInfo: ReviewThreadsPageInfo | undefined =
      payload.repository?.pullRequest?.reviewThreads?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
      break;
    }
    cursor = String(pageInfo.endCursor);
  }

  return threads;
}

async function getCodexSignals(client: GitHubApiClient, prNumber: number, config: GateConfig) {
  const reviewSignals = (
    await paginateRest<any>(
      client,
      `/repos/${client.owner}/${client.repo}/pulls/${prNumber}/reviews`
    )
  )
    .filter((review) => isCodexActor(String(review.user?.login || ""), config))
    .map((review) => ({
      actorLogin: String(review.user?.login || ""),
      state: review.state ? String(review.state) : null,
      body: String(review.body || ""),
      submittedAt: String(review.submitted_at || review.submittedAt || ""),
      url: String(review.html_url || ""),
      kind: "review" as const
    }));
  const issueCommentSignals = (
    await paginateRest<any>(
      client,
      `/repos/${client.owner}/${client.repo}/issues/${prNumber}/comments`
    )
  )
    .filter((comment) => isCodexActor(String(comment.user?.login || ""), config))
    .map((comment) => ({
      actorLogin: String(comment.user?.login || ""),
      state: null,
      body: String(comment.body || ""),
      submittedAt: String(comment.created_at || ""),
      url: String(comment.html_url || ""),
      kind: "issue-comment" as const
    }));

  return [...reviewSignals, ...issueCommentSignals];
}

async function getChangedFiles(client: GitHubApiClient, prNumber: number): Promise<ChangedFile[]> {
  return (
    await paginateRest<any>(client, `/repos/${client.owner}/${client.repo}/pulls/${prNumber}/files`)
  ).map((file) => ({
    path: String(file.filename || ""),
    status: String(file.status || ""),
    additions: Number(file.additions || 0),
    deletions: Number(file.deletions || 0),
    changes: Number(file.changes || 0),
    patch: typeof file.patch === "string" ? file.patch : null
  }));
}

async function getSnapshot(
  client: GitHubApiClient,
  prNumber: number,
  config: GateConfig
): Promise<Snapshot> {
  const pr = await getPullRequest(client, prNumber);
  pr.headCommitAt = await getHeadCommitTimestamp(client, pr.headSha);

  return {
    pr,
    branchFreshness: await getBranchFreshness(client, pr),
    workflowJobs: await getWorkflowJobs(client, pr.headSha),
    reviewThreads: await getReviewThreads(client, prNumber),
    codexSignals: await getCodexSignals(client, prNumber, config),
    changedFiles: await getChangedFiles(client, prNumber)
  };
}

async function upsertSummaryComment(
  client: GitHubApiClient,
  prNumber: number,
  body: string,
  marker: string
): Promise<ApplyCommentStatus> {
  const comments = await paginateRest<any>(
    client,
    `/repos/${client.owner}/${client.repo}/issues/${prNumber}/comments`
  );
  const existing = comments.find(
    (comment) =>
      String(comment.user?.login || "") === "github-actions[bot]" &&
      String(comment.body || "").includes(marker)
  );

  if (!existing) {
    await client.requestJson(
      "POST",
      `/repos/${client.owner}/${client.repo}/issues/${prNumber}/comments`,
      {
        body
      }
    );
    return "created";
  }

  if (String(existing.body || "") === body) {
    return "unchanged";
  }

  await client.requestJson(
    "PATCH",
    `/repos/${client.owner}/${client.repo}/issues/comments/${existing.id}`,
    { body }
  );
  return "updated";
}

async function markReadyForReview(
  client: GitHubApiClient,
  pullRequestNodeId: string
): Promise<boolean> {
  await client.graphql(
    `
      mutation MarkReady($pullRequestId: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
          pullRequest {
            id
            isDraft
          }
        }
      }
    `,
    {
      pullRequestId: pullRequestNodeId
    }
  );
  return true;
}

function canPromoteDraftToReady(evaluation: ReadinessEvaluation, config: GateConfig): boolean {
  return (
    evaluation.decision === "ready" &&
    evaluation.blockers.length === 0 &&
    evaluation.checkStatuses.every((status) => status.status === "pass") &&
    evaluation.qualityStatuses.every((status) => status.status === "pass") &&
    !!evaluation.latestCodexSignal &&
    !!evaluation.codexGreenlight &&
    isGreenlightSignal(evaluation.latestCodexSignal, config)
  );
}

async function applyEvaluation(
  client: GitHubApiClient,
  snapshot: Snapshot,
  evaluation: ReadinessEvaluation,
  config: GateConfig,
  apply: boolean
): Promise<ApplyResult> {
  if (!apply || !evaluation.targeted || evaluation.decision === "skipped") {
    return {
      commentStatus: "skipped",
      markedReady: false
    };
  }

  const commentStatus = await upsertSummaryComment(
    client,
    snapshot.pr.number,
    evaluation.summary,
    config.summaryCommentMarker
  );

  if (!canPromoteDraftToReady(evaluation, config) || !snapshot.pr.isDraft) {
    return {
      commentStatus,
      markedReady: false
    };
  }

  await markReadyForReview(client, snapshot.pr.nodeId);
  return {
    commentStatus,
    markedReady: true
  };
}

function buildBatchSummary(results: EvaluationResult[]): string {
  if (results.length === 0) {
    return ["# Codex PR Readiness", "", "No targeted draft PRs were evaluated in this run."].join(
      "\n"
    );
  }

  const lines = ["# Codex PR Readiness", ""];
  results.forEach((result) => {
    const blockerCount = result.evaluation.blockers.length;
    const advisoryCount = result.evaluation.advisories.length;
    lines.push(
      `- PR #${result.pr.number}: ${result.evaluation.decision.toUpperCase()} ` +
        `(${blockerCount} blocker(s), ${advisoryCount} advisory/advisories, comment ${result.applyResult.commentStatus}, marked ready ${result.applyResult.markedReady ? "yes" : "no"})`
    );
  });

  return lines.join("\n");
}

function parseArgs(argv: string[]): CommandOptions {
  const options: CommandOptions = {
    apply: false,
    configPath: null,
    eventPath: null,
    repository: null,
    prNumbers: [],
    jsonOutputPath: null,
    summaryOutputPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    const next = argv[index + 1];
    if (arg === "--config" && next) {
      options.configPath = next;
      index += 1;
      continue;
    }

    if (arg === "--event-path" && next) {
      options.eventPath = next;
      index += 1;
      continue;
    }

    if (arg === "--repository" && next) {
      options.repository = next;
      index += 1;
      continue;
    }

    if (arg === "--pr-number" && next) {
      options.prNumbers.push(Number(next));
      index += 1;
      continue;
    }

    if (arg === "--json-output" && next) {
      options.jsonOutputPath = next;
      index += 1;
      continue;
    }

    if (arg === "--summary-output" && next) {
      options.summaryOutputPath = next;
      index += 1;
      continue;
    }
  }

  return options;
}

function parseEventPrNumbers(eventPath: string | null): number[] {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return [];
  }

  const payload = readJsonFile<any>(eventPath);
  const eventName = String(process.env.GITHUB_EVENT_NAME || payload.action || "");

  if (payload.pull_request?.number) {
    return [Number(payload.pull_request.number)];
  }

  if (
    eventName === "pull_request_review" &&
    payload.pull_request?.number &&
    Number.isInteger(Number(payload.pull_request.number))
  ) {
    return [Number(payload.pull_request.number)];
  }

  if (eventName === "issue_comment" && payload.issue?.pull_request && payload.issue?.number) {
    return [Number(payload.issue.number)];
  }

  if (eventName === "workflow_run") {
    return asArray(payload.workflow_run?.pull_requests)
      .map((entry: any) => Number(entry?.number || 0))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  if (eventName === "workflow_dispatch" && payload.inputs?.pr_number) {
    const value = Number(payload.inputs.pr_number);
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  return [];
}

async function resolveTargetPrNumbers(
  client: GitHubApiClient,
  options: CommandOptions,
  config: GateConfig
): Promise<number[]> {
  const explicitPrNumbers = options.prNumbers.filter(
    (value) => Number.isInteger(value) && value > 0
  );
  if (explicitPrNumbers.length > 0) {
    return Array.from(new Set(explicitPrNumbers));
  }

  const eventPrNumbers = parseEventPrNumbers(options.eventPath);
  if (eventPrNumbers.length > 0) {
    return Array.from(new Set(eventPrNumbers));
  }

  const openPullRequests = (
    await paginateRest<GitHubPullRequestListItem>(
      client,
      `/repos/${client.owner}/${client.repo}/pulls?state=open`
    )
  )
    .map((raw) =>
      toPullRequestSummary({
        ...raw,
        html_url: "",
        node_id: "",
        additions: 0,
        deletions: 0,
        changed_files: 0,
        mergeable: null,
        mergeable_state: null
      })
    )
    .filter((pr) => isTargetPullRequest(pr, config).targeted);

  return openPullRequests.map((pr) => pr.number);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = loadGateConfig(options.configPath || DEFAULT_CONFIG_PATH);
  const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "");
  const repository = options.repository || process.env.GITHUB_REPOSITORY || "";

  if (!token) {
    throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required.");
  }

  if (!repository) {
    throw new Error("GitHub repository could not be resolved. Pass --repository owner/name.");
  }

  const client = new GitHubApiClient(repository, token);
  const prNumbers = await resolveTargetPrNumbers(client, options, config);
  const results: EvaluationResult[] = [];

  for (const prNumber of prNumbers) {
    const snapshot = await getSnapshot(client, prNumber, config);
    const evaluation = evaluateReadinessFromSnapshot(snapshot, config);
    if (!evaluation.targeted) {
      continue;
    }

    const applyResult = await applyEvaluation(client, snapshot, evaluation, config, options.apply);
    results.push({
      pr: snapshot.pr,
      evaluation,
      applyResult
    });
  }

  const output = {
    evaluatedPullRequests: results.map((result) => ({
      number: result.pr.number,
      url: result.pr.url,
      decision: result.evaluation.decision,
      blockers: result.evaluation.blockers,
      advisories: result.evaluation.advisories,
      commentStatus: result.applyResult.commentStatus,
      markedReady: result.applyResult.markedReady
    }))
  };

  if (options.jsonOutputPath) {
    fs.writeFileSync(options.jsonOutputPath, JSON.stringify(output, null, 2));
  }

  const batchSummary = buildBatchSummary(results);
  if (options.summaryOutputPath) {
    fs.writeFileSync(options.summaryOutputPath, batchSummary);
  }

  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  void run();
}

module.exports = {
  READY_COMMENT_HEADING,
  buildSummary,
  evaluateReadinessFromSnapshot,
  isTargetPullRequest,
  loadGateConfig,
  parseAddedLines,
  __testables: {
    GitHubApiClient,
    applyEvaluation,
    buildBatchSummary,
    getSnapshot,
    markReadyForReview,
    parseArgs,
    parseEventPrNumbers,
    resolveTargetPrNumbers,
    upsertSummaryComment
  }
};
