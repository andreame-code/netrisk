function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

export function resolveObservabilityEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  return firstNonEmpty(env.NETRISK_APP_ENVIRONMENT, env.VERCEL_ENV, env.NODE_ENV) || "development";
}

export function resolveObservabilityRelease(env: NodeJS.ProcessEnv = process.env): string {
  return (
    firstNonEmpty(
      env.NETRISK_RELEASE,
      env.SENTRY_RELEASE,
      env.VERCEL_GIT_COMMIT_SHA,
      env.GITHUB_SHA,
      env.COMMIT_SHA,
      env.npm_package_version
    ) || "local-dev"
  );
}

export function parseSentryOrigin(dsn: unknown): string | null {
  const value = firstNonEmpty(dsn);
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

module.exports = {
  parseSentryOrigin,
  resolveObservabilityEnvironment,
  resolveObservabilityRelease
};
