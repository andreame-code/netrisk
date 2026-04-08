const REQUIRED_DEPLOY_ENV_KEYS = [
  "DATASTORE_DRIVER",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

function hasValue(value) {
  return typeof value === "string" ? value.trim() !== "" : Boolean(value);
}

function shouldValidateDeployEnv(env = process.env) {
  if (!env || !env.VERCEL) {
    return false;
  }

  const targetEnv = String(env.VERCEL_ENV || "").toLowerCase();
  return targetEnv === "preview" || targetEnv === "production";
}

function requestedDatastoreDriver(env = process.env) {
  return String(env?.DATASTORE_DRIVER || "").trim().toLowerCase();
}

function usesSupabaseDatastore(env = process.env) {
  const driver = requestedDatastoreDriver(env);
  if (driver === "supabase") {
    return true;
  }

  if (driver === "sqlite") {
    return false;
  }

  return hasValue(env?.SUPABASE_URL) || hasValue(env?.NEXT_PUBLIC_SUPABASE_URL);
}

function missingRequiredDeployEnv(env = process.env) {
  const missing = [];
  if (!hasValue(env?.DATASTORE_DRIVER)) {
    missing.push("DATASTORE_DRIVER");
  }

  if (!usesSupabaseDatastore(env)) {
    return missing;
  }

  if (!hasValue(env?.SUPABASE_URL) && !hasValue(env?.NEXT_PUBLIC_SUPABASE_URL)) {
    missing.push("SUPABASE_URL");
  }

  if (
    !hasValue(env?.SUPABASE_SERVICE_ROLE_KEY) &&
    !hasValue(env?.SUPABASE_ANON_KEY) &&
    !hasValue(env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) &&
    !hasValue(env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

module.exports = {
  REQUIRED_DEPLOY_ENV_KEYS,
  missingRequiredDeployEnv,
  requestedDatastoreDriver,
  shouldValidateDeployEnv
};
