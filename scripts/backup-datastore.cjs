const path = require("path");
const { createDatastore } = require("../backend/datastore.cjs");

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestampLabel(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function parseArgs(argv) {
  const args = {};

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
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbFile = args.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite");
  const outputFile = args.outputFile || path.join(__dirname, "..", "data", "backups", `netrisk-${timestampLabel()}.sqlite`);
  const datastore = createDatastore({ dbFile });

  try {
    const result = await datastore.backupTo(outputFile);
    console.log(`Backup creato: ${result.targetFile}`);
  } finally {
    datastore.close();
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
