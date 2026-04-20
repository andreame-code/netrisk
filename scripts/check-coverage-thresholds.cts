const fs = require("node:fs");
const path = require("node:path");

type CoverageMetricKey = "statements" | "branches" | "functions" | "lines";
type CoverageMetric = {
  pct?: number;
};
type CoverageSummary = {
  total?: Partial<Record<CoverageMetricKey, CoverageMetric>>;
};

const MINIMUM_COVERAGE: Record<CoverageMetricKey, number> = {
  statements: 88,
  branches: 72.9,
  functions: 75,
  lines: 88
};

function loadCoverageSummary(): CoverageSummary {
  const summaryPath = path.join(process.cwd(), "coverage", "coverage-summary.json");
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Coverage summary not found at ${summaryPath}`);
  }

  return JSON.parse(fs.readFileSync(summaryPath, "utf8")) as CoverageSummary;
}

function main(): void {
  const summary = loadCoverageSummary();
  const failed: string[] = [];

  (Object.keys(MINIMUM_COVERAGE) as CoverageMetricKey[]).forEach((key) => {
    const actual = Number(summary.total?.[key]?.pct);
    const expected = MINIMUM_COVERAGE[key];

    if (!Number.isFinite(actual)) {
      failed.push(`${key}: missing coverage percentage`);
      return;
    }

    if (actual < expected) {
      failed.push(`${key}: ${actual.toFixed(2)}% < required ${expected.toFixed(2)}%`);
    }
  });

  if (!failed.length) {
    console.log("Coverage thresholds satisfied.");
    return;
  }

  failed.forEach((message) => {
    console.error(message);
  });
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  MINIMUM_COVERAGE
};
