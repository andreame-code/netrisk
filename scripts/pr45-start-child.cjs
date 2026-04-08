const { spawnSync } = require("child_process");
const {
  CHILD_BRANCH_PREFIX,
  PARENT_BRANCH,
  PARENT_PR_NUMBER
} = require("./pr45-stack-config.cjs");

function usage() {
  console.log("Usage: node scripts/pr45-start-child.cjs <topic>");
  console.log("");
  console.log("Creates a child branch from the current head of PR #45.");
  console.log("");
  console.log("Example:");
  console.log("  npm run pr45:branch -- lobby-polish");
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

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hasUncommittedChanges() {
  const result = run("git", ["status", "--porcelain"]);
  return Boolean((result.stdout || "").trim());
}

function branchExistsLocal(branchName) {
  const result = run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    allowFailure: true
  });
  return result.status === 0;
}

function branchExistsRemote(branchName) {
  const result = run("git", ["ls-remote", "--heads", "origin", branchName]);
  return Boolean((result.stdout || "").trim());
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const topic = slugify(args[0]);
  if (!topic) {
    fail("A child branch topic is required.");
  }

  if (hasUncommittedChanges()) {
    fail("Working tree is not clean. Commit or stash your changes before creating a child branch.");
  }

  const branchName = `${CHILD_BRANCH_PREFIX}${topic}`;

  run("git", ["fetch", "origin", PARENT_BRANCH], { stdio: "inherit" });

  if (branchExistsLocal(branchName)) {
    fail(`Local branch already exists: ${branchName}`);
  }

  if (branchExistsRemote(branchName)) {
    fail(`Remote branch already exists on origin: ${branchName}`);
  }

  run("git", ["switch", "-c", branchName, `origin/${PARENT_BRANCH}`], { stdio: "inherit" });

  console.log("");
  console.log(`Created child branch: ${branchName}`);
  console.log(`Parent integration branch: ${PARENT_BRANCH}`);
  console.log(`Parent PR: #${PARENT_PR_NUMBER}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Implement your fine tuning changes on this branch.");
  console.log("2. Commit your work.");
  console.log(`3. Open the stacked PR with: npm run pr45:pr -- "${topic.replace(/-/g, " ")}"`);
}

main();
