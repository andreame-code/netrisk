const { spawnSync } = require("child_process");
const {
  CHILD_BRANCH_PREFIX,
  PARENT_BRANCH,
  PARENT_PR_NUMBER,
  REPO_FULL_NAME
} = require("./pr45-stack-config.cjs");

function usage() {
  console.log("Usage: node scripts/pr45-open-child-pr.cjs [title] [--draft]");
  console.log("");
  console.log("Pushes the current child branch and opens a stacked PR into the PR #45 branch.");
  console.log("");
  console.log("Examples:");
  console.log('  npm run pr45:pr -- "Lobby polish"');
  console.log('  npm run pr45:pr -- "Engine balance" --draft');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    shell: false
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.status !== 0) {
    fail((result.stderr || result.stdout || "").trim() || `${command} ${args.join(" ")} failed`);
  }

  return result;
}

function currentBranch() {
  return (run("git", ["branch", "--show-current"]).stdout || "").trim();
}

function hasUncommittedChanges() {
  const result = run("git", ["status", "--porcelain"]);
  return Boolean((result.stdout || "").trim());
}

function humanizeBranchSuffix(branchName) {
  const suffix = branchName.startsWith(CHILD_BRANCH_PREFIX)
    ? branchName.slice(CHILD_BRANCH_PREFIX.length)
    : branchName;

  return suffix
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTitle(title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("[PR45]") ? trimmed : `[PR45] ${trimmed}`;
}

function buildBody(branchName) {
  return [
    "## Summary",
    `- Stacked child PR into #${PARENT_PR_NUMBER}`,
    `- Child branch: \`${branchName}\``,
    "",
    "## Parent",
    `- Parent integration PR: #${PARENT_PR_NUMBER}`,
    `- Parent branch: \`${PARENT_BRANCH}\``,
    "",
    "## Notes",
    "- This PR targets the PR 45 branch, not `main`.",
    "- Merge this PR first into the parent branch, then keep PR 45 for the final merge to `main`."
  ].join("\n");
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const draft = args.includes("--draft");
  const titleArg = args.filter((value) => value !== "--draft").join(" ").trim();
  const branchName = currentBranch();

  if (!branchName) {
    fail("Could not determine the current git branch.");
  }

  if (branchName === PARENT_BRANCH) {
    fail(`You are on the parent branch (${PARENT_BRANCH}). Switch to a child branch before opening a stacked PR.`);
  }

  if (!branchName.startsWith(CHILD_BRANCH_PREFIX)) {
    fail(`Current branch must start with ${CHILD_BRANCH_PREFIX} to open a PR into #${PARENT_PR_NUMBER}.`);
  }

  if (hasUncommittedChanges()) {
    fail("Working tree is not clean. Commit or stash your changes before opening the stacked PR.");
  }

  const title = normalizeTitle(titleArg || humanizeBranchSuffix(branchName));
  if (!title) {
    fail("Could not derive a PR title. Pass one explicitly.");
  }

  run("git", ["push", "-u", "origin", branchName], { stdio: "inherit" });

  const prCreateArgs = [
    "pr",
    "create",
    "--repo",
    REPO_FULL_NAME,
    "--base",
    PARENT_BRANCH,
    "--head",
    branchName,
    "--title",
    title,
    "--body",
    buildBody(branchName)
  ];

  if (draft) {
    prCreateArgs.push("--draft");
  }

  run("gh", prCreateArgs, { stdio: "inherit" });
}

main();
