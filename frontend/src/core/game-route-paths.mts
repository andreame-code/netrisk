function isLegacyGameRoute(pathname: string): boolean {
  return (
    pathname === "/legacy/game.html" ||
    pathname === "/legacy/game" ||
    pathname.startsWith("/legacy/game/")
  );
}

export function requestedGameIdFromLocation(pathname: string, search: string): string | null {
  const canonicalPathMatch = pathname.match(/^\/game\/([^/]+)$/);
  if (canonicalPathMatch) {
    return decodeURIComponent(canonicalPathMatch[1]);
  }

  const legacyPathMatch = pathname.match(/^\/legacy\/game\/([^/]+)$/);
  if (legacyPathMatch) {
    return decodeURIComponent(legacyPathMatch[1]);
  }

  return new URLSearchParams(search).get("gameId");
}

export function buildSyncedGameLocation(
  currentHref: string,
  gameId: string | null | undefined
): string {
  const url = new URL(currentHref);

  if (gameId) {
    if (isLegacyGameRoute(url.pathname)) {
      url.pathname = "/legacy/game.html";
      url.searchParams.set("gameId", gameId);
      return url.pathname + url.search + url.hash;
    }

    return "/game/" + encodeURIComponent(gameId);
  }

  if (isLegacyGameRoute(url.pathname)) {
    url.pathname = "/legacy/game.html";
    url.searchParams.delete("gameId");
    return url.pathname + url.search + url.hash;
  }

  if (url.pathname !== "/game.html") {
    return "/game.html";
  }

  url.searchParams.delete("gameId");
  return url.pathname + url.search + url.hash;
}
