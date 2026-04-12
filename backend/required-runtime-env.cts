// @ts-nocheck
const REQUIRED_DEPLOY_ENV_KEYS = [
  "AUTH_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATASTORE_DRIVER"
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

function missingRequiredDeployEnv(env = process.env) {
  return REQUIRED_DEPLOY_ENV_KEYS.filter((key) => !hasValue(env[key]));
}

module.exports = {
  REQUIRED_DEPLOY_ENV_KEYS,
  missingRequiredDeployEnv,
  shouldValidateDeployEnv
};
