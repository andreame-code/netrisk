const LEGACY_NAMESPACE_PREFIX = "/legacy";
const LEGACY_GAME_DOCUMENT_PATH = `${LEGACY_NAMESPACE_PREFIX}/game.html`;

function isLegacyNamespacePath(pathname: string): boolean {
  return pathname === LEGACY_NAMESPACE_PREFIX || pathname.startsWith(`${LEGACY_NAMESPACE_PREFIX}/`);
}

export function requestedGameIdFromLocation(pathname: string, search: string): string | null {
  const canonicalPathMatch = pathname.match(/^\/game\/([^/]+)$/);
  if (canonicalPathMatch) {
    return decodeURIComponent(canonicalPathMatch[1]);
  }

  return new URLSearchParams(search).get("gameId");
}

export function buildSyncedGameLocation(
  currentHref: string,
  gameId: string | null | undefined
): string {
  const url = new URL(currentHref);
  const isLegacyPath = isLegacyNamespacePath(url.pathname);

  if (isLegacyPath) {
    url.pathname = LEGACY_GAME_DOCUMENT_PATH;
    if (gameId) {
      url.searchParams.set("gameId", gameId);
    } else {
      url.searchParams.delete("gameId");
    }

    return url.pathname + url.search + url.hash;
  }

  if (gameId) {
    return "/game/" + encodeURIComponent(gameId);
  }

  if (url.pathname !== "/game") {
    return "/game";
  }

  url.searchParams.delete("gameId");
  return url.pathname + url.search + url.hash;
}
