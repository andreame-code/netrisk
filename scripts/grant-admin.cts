const path = require("path");
const { createDatastore } = require("../backend/datastore.cjs");

interface GrantAdminArgs {
  username?: string;
  role?: "admin" | "user";
  driver?: string;
  dbFile?: string;
  dataFile?: string;
  gamesFile?: string;
  sessionsFile?: string;
}

interface DatastoreLike {
  findUserByUsername(username: string): { username: string; role?: string } | null;
  updateUserRoleByUsername(username: string, role: string): void;
}

function parseArgs(argv: string[]): GrantAdminArgs {
  const args: GrantAdminArgs = {
    role: "admin"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!current) {
      continue;
    }

    if (!current.startsWith("--") && !args.username) {
      args.username = current;
      continue;
    }

    if (!next) {
      continue;
    }

    switch (current) {
      case "--username":
        args.username = next;
        index += 1;
        break;
      case "--role":
        args.role = next === "user" ? "user" : "admin";
        index += 1;
        break;
      case "--driver":
        args.driver = next;
        index += 1;
        break;
      case "--db-file":
        args.dbFile = next;
        index += 1;
        break;
      case "--data-file":
        args.dataFile = next;
        index += 1;
        break;
      case "--games-file":
        args.gamesFile = next;
        index += 1;
        break;
      case "--sessions-file":
        args.sessionsFile = next;
        index += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function resolveOptionalPath(filePath: string | undefined): string | undefined {
  return filePath ? path.resolve(filePath) : undefined;
}

function grantRole(args: GrantAdminArgs) {
  if (!args.username) {
    throw new Error("Specifica un username: `npm run admin:grant -- --username <nome>`.");
  }

  const datastore = createDatastore({
    driver: args.driver,
    dbFile: resolveOptionalPath(args.dbFile),
    dataFile: resolveOptionalPath(args.dataFile),
    gamesFile: resolveOptionalPath(args.gamesFile),
    sessionsFile: resolveOptionalPath(args.sessionsFile)
  }) as DatastoreLike;

  const existingUser = datastore.findUserByUsername(String(args.username));
  if (!existingUser) {
    throw new Error(`Utente non trovato: ${args.username}`);
  }

  const role = args.role === "user" ? "user" : "admin";
  datastore.updateUserRoleByUsername(existingUser.username, role);

  const updatedUser = datastore.findUserByUsername(existingUser.username);
  if (!updatedUser) {
    throw new Error(`Impossibile rileggere l'utente aggiornato: ${existingUser.username}`);
  }

  return {
    username: updatedUser.username,
    role: updatedUser.role === "admin" ? "admin" : "user"
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const result = grantRole(args);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

module.exports = {
  grantRole,
  parseArgs
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
