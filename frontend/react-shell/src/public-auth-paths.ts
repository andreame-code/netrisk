import { useLocation } from "react-router-dom";

export type ShellNamespace = "canonical" | "react";

function isReactShellPath(pathname: string): boolean {
  return pathname === "/react" || pathname.startsWith("/react/");
}

function normalizeLegacyDocumentPath(pathname: string): string {
  const url = new URL(pathname, "http://localhost");

  if (url.pathname === "/index.html" || url.pathname === "/landing.html") {
    url.pathname = "/";
  } else if (url.pathname === "/register.html") {
    url.pathname = "/register";
  } else if (url.pathname === "/lobby.html") {
    url.pathname = "/lobby";
  } else if (url.pathname === "/new-game.html") {
    url.pathname = "/lobby/new";
  } else if (url.pathname === "/profile.html") {
    url.pathname = "/profile";
  } else if (url.pathname === "/game.html") {
    const gameId = url.searchParams.get("gameId");
    if (gameId) {
      url.pathname = `/game/${encodeURIComponent(gameId)}`;
      url.searchParams.delete("gameId");
    } else {
      url.pathname = "/game";
    }
  }

  return url.pathname + url.search + url.hash;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login?") ||
    pathname === "/register" ||
    pathname.startsWith("/register?") ||
    pathname === "/register.html" ||
    pathname.startsWith("/register.html?") ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/unauthorized?") ||
    pathname === "/react/login" ||
    pathname.startsWith("/react/login?") ||
    pathname === "/react/register" ||
    pathname.startsWith("/react/register?") ||
    pathname === "/react/unauthorized" ||
    pathname.startsWith("/react/unauthorized?")
  );
}

function isReactRelativeShellPath(pathname: string): boolean {
  return (
    pathname === "/lobby" ||
    pathname.startsWith("/lobby?") ||
    pathname === "/lobby/new" ||
    pathname.startsWith("/lobby/new?") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile?") ||
    pathname === "/game" ||
    pathname.startsWith("/game?") ||
    /^\/game\/[^?#]+/.test(pathname) ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/unauthorized?")
  );
}

function hydrateNamespacePath(
  pathname: string,
  namespace: ShellNamespace = currentShellNamespace()
): string {
  const normalizedPathname = normalizeLegacyDocumentPath(pathname);

  if (
    namespace !== "react" ||
    normalizedPathname.startsWith("/react/") ||
    normalizedPathname === "/react"
  ) {
    return normalizedPathname;
  }

  return isReactRelativeShellPath(normalizedPathname)
    ? `/react${normalizedPathname}`
    : normalizedPathname;
}

function normalizeCanonicalShellPath(pathname: string): string {
  return normalizeLegacyDocumentPath(pathname);
}

function serializeNextPathForNamespace(
  pathname: string,
  namespace: ShellNamespace = currentShellNamespace()
): string {
  if (namespace !== "react" || !pathname.startsWith("/react/")) {
    return pathname;
  }

  return pathname.replace(/^\/react/, "");
}

export function detectShellNamespace(pathname: string): ShellNamespace {
  return isReactShellPath(pathname) ? "react" : "canonical";
}

export function currentShellNamespace(): ShellNamespace {
  if (typeof window === "undefined") {
    return "canonical";
  }

  return detectShellNamespace(window.location.pathname);
}

export function useShellNamespace(): ShellNamespace {
  const location = useLocation();
  return detectShellNamespace(location.pathname);
}

export function buildBootstrapPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react" : "/";
}

export function buildLoginPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/login" : "/login";
}

export function buildRegisterPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/register" : "/register";
}

export function buildUnauthorizedPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/unauthorized" : "/unauthorized";
}

export function buildLobbyPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/lobby" : "/lobby";
}

export function buildNewGamePath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/lobby/new" : "/lobby/new";
}

export function buildProfilePath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/profile" : "/profile";
}

export function buildGameIndexPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/game" : "/game";
}

export function buildGamePath(
  gameId: string,
  namespace: ShellNamespace = currentShellNamespace()
): string {
  return `${buildGameIndexPath(namespace)}/${encodeURIComponent(gameId)}`;
}

export function normalizeNextPath(
  nextPath: string | null,
  fallback = buildLobbyPath(currentShellNamespace())
): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  const normalizedNextPath = normalizeLegacyDocumentPath(nextPath);

  if (isReservedAuthPath(normalizedNextPath)) {
    return fallback;
  }

  const namespace = detectShellNamespace(fallback);
  const hydratedPath = hydrateNamespacePath(normalizedNextPath, namespace);

  return namespace === "react" ? hydratedPath : normalizeCanonicalShellPath(hydratedPath);
}

export function buildLoginHref(
  nextPath: string,
  namespace: ShellNamespace = currentShellNamespace()
): string {
  return `${buildLoginPath(namespace)}?next=${encodeURIComponent(
    serializeNextPathForNamespace(normalizeNextPath(nextPath, buildLobbyPath(namespace)), namespace)
  )}`;
}

export function buildRegisterHref(
  nextPath: string,
  namespace: ShellNamespace = currentShellNamespace()
): string {
  return `${buildRegisterPath(namespace)}?next=${encodeURIComponent(
    serializeNextPathForNamespace(normalizeNextPath(nextPath, buildLobbyPath(namespace)), namespace)
  )}`;
}
