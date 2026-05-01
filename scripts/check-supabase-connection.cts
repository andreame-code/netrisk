type FetchLike = typeof fetch;

type CheckOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  tables?: string[];
};

type SupabaseConnectionResult = {
  ok: boolean;
  urlHost: string;
  schema: string;
  checkedTables: string[];
};

const DEFAULT_TABLES = ["users", "games", "sessions", "app_state"];
const PROBE_COLUMNS: Record<string, string> = {
  app_state: "key",
  sessions: "token"
};

function requireEnvValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Supabase connection env: ${key}`);
  }

  return value.trim();
}

function safeHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

async function checkSupabaseConnection(
  options: CheckOptions = {}
): Promise<SupabaseConnectionResult> {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const supabaseUrl = requireEnvValue(env, "SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  const schema = (env.SUPABASE_DB_SCHEMA || "public").trim() || "public";
  const tables = options.tables || DEFAULT_TABLES;

  for (const table of tables) {
    const column = PROBE_COLUMNS[table] || "id";
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(
      column
    )}&limit=1`;
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Accept-Profile": schema,
        Prefer: "count=exact"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Supabase connection check failed for table ${table} (${response.status}): ${
          text || response.statusText || "empty response"
        }`
      );
    }
  }

  return {
    ok: true,
    urlHost: safeHost(supabaseUrl),
    schema,
    checkedTables: tables
  };
}

async function main(): Promise<void> {
  const result = await checkSupabaseConnection();
  console.log(
    `Supabase connection OK: host=${result.urlHost}; schema=${result.schema}; tables=${result.checkedTables.join(
      ", "
    )}`
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_TABLES,
  checkSupabaseConnection,
  requireEnvValue
};
