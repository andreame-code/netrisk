const REQUIRED_DEPLOY_ENV_KEYS = [
  "AUTH_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATASTORE_DRIVER"
];

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim() !== "" : Boolean(value);
}

function shouldValidateDeployEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env || !env.VERCEL) {
    return false;
  }

  const targetEnv = String(env.VERCEL_ENV || "").toLowerCase();
  return targetEnv === "preview" || targetEnv === "production";
}

function missingRequiredDeployEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_DEPLOY_ENV_KEYS.filter((key) => !hasValue(env[key]));
}

module.exports = {
  REQUIRED_DEPLOY_ENV_KEYS,
  missingRequiredDeployEnv,
  shouldValidateDeployEnv
};
