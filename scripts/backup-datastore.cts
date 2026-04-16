const fs = require("fs");
const path = require("path");
const { createDatastore } = require("../backend/datastore.cjs");

interface BackupArgs {
  dbFile?: string;
  outputFile?: string;
  keep?: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function timestampLabel(date: Date = new Date()): string {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("") +
    "-" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("")
  );
}

function parseArgs(argv: string[]): BackupArgs {
  const args: BackupArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--db" && next) {
      args.dbFile = next;
      index += 1;
      continue;
    }

    if (current === "--out" && next) {
      args.outputFile = next;
      index += 1;
      continue;
    }

    if (current === "--keep" && next) {
      args.keep = Number(next);
      index += 1;
      continue;
    }
  }

  return args;
}

function backupDirectoryFor(outputFile: string): string {
  return path.dirname(outputFile);
}

function baseNameFor(outputFile: string): string {
  return path.basename(outputFile).replace(/-\d{8}-\d{6}\.sqlite$/, "");
}

function pruneBackups(outputFile: string, keepCount?: number): string[] {
  if (typeof keepCount !== "number" || !Number.isInteger(keepCount) || keepCount < 1) {
    return [];
  }
  const normalizedKeepCount = keepCount;

  const directory = backupDirectoryFor(outputFile);
  const baseName = baseNameFor(outputFile);
  if (!fs.existsSync(directory)) {
    return [];
  }

  const backups = fs
    .readdirSync(directory)
    .filter((name: string) => name.startsWith(baseName + "-") && name.endsWith(".sqlite"))
    .sort()
    .reverse();

  const removed = backups
    .slice(normalizedKeepCount)
    .map((name: string) => path.join(directory, name));
  removed.forEach((filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  return removed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dbFile = args.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite");
  const outputFile =
    args.outputFile ||
    path.join(__dirname, "..", "data", "backups", `netrisk-${timestampLabel()}.sqlite`);
  const datastore = createDatastore({ dbFile });

  try {
    const result = await datastore.backupTo(outputFile);
    const removed = pruneBackups(outputFile, args.keep);
    console.log(`Backup creato: ${result.targetFile}`);
    if (removed.length > 0) {
      console.log(`Backup rimossi: ${removed.length}`);
    }
  } finally {
    datastore.close();
  }
}

module.exports = {
  backupDirectoryFor,
  baseNameFor,
  parseArgs,
  pruneBackups,
  timestampLabel
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
