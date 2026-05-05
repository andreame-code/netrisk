type HeaderValue = string | string[] | undefined;

type AuthThrottleScope = "account" | "login";

type AuthThrottleBucket = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

type AuthThrottleKey = {
  scope: AuthThrottleScope;
  ip: string;
  username: string;
};

type AuthThrottleDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type AuthAttemptThrottleOptions = {
  maxAttempts?: number;
  maxIpAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
  maxLockoutMs?: number;
  now?: () => number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_MAX_IP_ATTEMPTS = 30;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOCKOUT_MS = 60 * 1000;
const DEFAULT_MAX_LOCKOUT_MS = 15 * 60 * 1000;

function normalizeUsername(username: unknown): string {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function normalizeIp(ip: unknown): string {
  return String(ip || "")
    .trim()
    .toLowerCase();
}

function firstHeaderValue(value: HeaderValue): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function resolveRequestIp(req: unknown): string {
  const request = req as {
    headers?: Record<string, HeaderValue>;
    socket?: {
      remoteAddress?: string;
    };
  };
  const headers = request?.headers || {};
  const forwardedFor = firstHeaderValue(headers["x-forwarded-for"]).split(",")[0].trim();
  const realIp = firstHeaderValue(headers["x-real-ip"]).trim();
  const socketIp = String(request?.socket?.remoteAddress || "").trim();

  return normalizeIp(forwardedFor || realIp || socketIp || "unknown");
}

function createAuthThrottleKey(
  scope: AuthThrottleScope,
  req: unknown,
  username: unknown
): AuthThrottleKey {
  return {
    scope,
    ip: resolveRequestIp(req),
    username: normalizeUsername(username)
  };
}

function createAuthAttemptThrottle(options: AuthAttemptThrottleOptions = {}) {
  const buckets = new Map<string, AuthThrottleBucket>();
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const maxIpAttempts = options.maxIpAttempts || DEFAULT_MAX_IP_ATTEMPTS;
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const lockoutMs = options.lockoutMs || DEFAULT_LOCKOUT_MS;
  const maxLockoutMs = options.maxLockoutMs || DEFAULT_MAX_LOCKOUT_MS;
  const now = options.now || Date.now;

  function bucketIds(key: AuthThrottleKey): Array<{ id: string; limit: number }> {
    return [
      {
        id: primaryBucketId(key),
        limit: maxAttempts
      },
      {
        id: `${key.scope}:ip:${key.ip}`,
        limit: maxIpAttempts
      }
    ];
  }

  function primaryBucketId(key: AuthThrottleKey): string {
    return `${key.scope}:ip:${key.ip}:user:${key.username || "unknown"}`;
  }

  function currentBucket(id: string, timestamp: number): AuthThrottleBucket | null {
    const bucket = buckets.get(id);
    if (!bucket) {
      return null;
    }

    if (timestamp - bucket.firstAttemptAt > windowMs && bucket.lockedUntil <= timestamp) {
      buckets.delete(id);
      return null;
    }

    return bucket;
  }

  function check(key: AuthThrottleKey): AuthThrottleDecision {
    const timestamp = now();
    const retryAfterMs = bucketIds(key).reduce((maxRetryAfterMs, entry) => {
      const bucket = currentBucket(entry.id, timestamp);
      if (!bucket || bucket.lockedUntil <= timestamp) {
        return maxRetryAfterMs;
      }

      return Math.max(maxRetryAfterMs, bucket.lockedUntil - timestamp);
    }, 0);

    return {
      allowed: retryAfterMs <= 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
    };
  }

  function recordFailure(key: AuthThrottleKey): AuthThrottleDecision {
    const timestamp = now();
    for (const entry of bucketIds(key)) {
      const bucket =
        currentBucket(entry.id, timestamp) ||
        ({
          attempts: 0,
          firstAttemptAt: timestamp,
          lockedUntil: 0
        } satisfies AuthThrottleBucket);

      bucket.attempts += 1;
      if (bucket.attempts >= entry.limit) {
        const overflowAttempts = bucket.attempts - entry.limit;
        const duration = Math.min(lockoutMs * 2 ** overflowAttempts, maxLockoutMs);
        bucket.lockedUntil = Math.max(bucket.lockedUntil, timestamp + duration);
      }

      buckets.set(entry.id, bucket);
    }

    return check(key);
  }

  function recordSuccess(key: AuthThrottleKey): void {
    buckets.delete(primaryBucketId(key));
  }

  return {
    check,
    recordFailure,
    recordSuccess
  };
}

module.exports = {
  createAuthAttemptThrottle,
  createAuthThrottleKey,
  resolveRequestIp
};
