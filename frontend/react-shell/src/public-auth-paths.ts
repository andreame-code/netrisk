import { useLocation } from "react-router-dom";

export type ShellNamespace = "canonical" | "react";

function isReactShellPath(pathname: string): boolean {
  return pathname === "/react" || pathname.startsWith("/react/");
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
  if (namespace !== "react" || pathname.startsWith("/react/") || pathname === "/react") {
    return pathname;
  }

  return isReactRelativeShellPath(pathname) ? `/react${pathname}` : pathname;
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
  return namespace === "react" ? "/react/register" : "/register.html";
}

export function buildUnauthorizedPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/unauthorized" : "/unauthorized";
}

export function buildLobbyPath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/lobby" : "/lobby.html";
}

export function buildNewGamePath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/lobby/new" : "/new-game.html";
}

export function buildProfilePath(namespace: ShellNamespace = currentShellNamespace()): string {
  return namespace === "react" ? "/react/profile" : "/profile.html";
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

  if (isReservedAuthPath(nextPath)) {
    return fallback;
  }

  return hydrateNamespacePath(nextPath);
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
