export function normalizeNextPath(nextPath: string | null, fallback = "/lobby"): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  if (
    nextPath === "/login" ||
    nextPath.startsWith("/login?") ||
    nextPath === "/register" ||
    nextPath.startsWith("/register?") ||
    nextPath === "/unauthorized"
  ) {
    return fallback;
  }

  return nextPath;
}

export function buildLoginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildRegisterHref(nextPath: string): string {
  return `/register?next=${encodeURIComponent(nextPath)}`;
}
