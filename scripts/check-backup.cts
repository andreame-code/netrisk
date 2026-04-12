const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const requiredTables = ["users", "sessions", "games", "app_state"];

interface CheckBackupArgs {
  file?: string;
}

interface SqliteCountRow {
  count?: number;
}

interface SqliteTableRow {
  name: string;
}

interface SqliteAppStateRow {
  value_json?: string;
}

function parseArgs(argv: string[]): CheckBackupArgs {
  const args: CheckBackupArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--file" && next) {
      args.file = next;
      index += 1;
    }
  }

  return args;
}

function inspectBackup(filePath: string | undefined) {
  if (!filePath) {
    throw new Error("La verifica richiede il percorso di un backup SQLite.");
  }

  const resolvedFile = path.resolve(filePath);
  if (!fs.existsSync(resolvedFile)) {
    throw new Error(`Backup non trovato: ${resolvedFile}`);
  }

  const db = new DatabaseSync(resolvedFile, { readOnly: true });

  try {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as SqliteTableRow[]).map((row) => row.name);
    const missingTables = requiredTables.filter((tableName) => !tables.includes(tableName));
    if (missingTables.length > 0) {
      throw new Error(`Backup incompleto: tabelle mancanti ${missingTables.join(", ")}`);
    }

    const activeGameRow = db.prepare("SELECT value_json FROM app_state WHERE key = ?").get("activeGameId") as SqliteAppStateRow | undefined;
    const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as SqliteCountRow;
    const gamesCount = db.prepare("SELECT COUNT(*) AS count FROM games").get() as SqliteCountRow;
    const sessionsCount = db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as SqliteCountRow;
    return {
      ok: true,
      file: resolvedFile,
      storage: "sqlite",
      counts: {
        users: Number(usersCount.count) || 0,
        games: Number(gamesCount.count) || 0,
        sessions: Number(sessionsCount.count) || 0
      },
      activeGameId: activeGameRow?.value_json ? JSON.parse(activeGameRow.value_json) : null
    };
  } finally {
    db.close();
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const summary = inspectBackup(args.file);
  console.log(JSON.stringify(summary, null, 2));
}

module.exports = {
  inspectBackup,
  parseArgs,
  requiredTables
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
