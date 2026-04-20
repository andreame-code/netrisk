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

  if (gameId) {
    return "/game/" + encodeURIComponent(gameId);
  }

  if (url.pathname !== "/game.html") {
    return "/game.html";
  }

  url.searchParams.delete("gameId");
  return url.pathname + url.search + url.hash;
}
