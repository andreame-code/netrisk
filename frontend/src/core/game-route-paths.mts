export function requestedGameIdFromLocation(pathname: string, search: string): string | null {
  const canonicalPathMatch = pathname.match(/^\/(?:react\/)?game\/([^/]+)$/);
  if (canonicalPathMatch) {
    return decodeURIComponent(canonicalPathMatch[1]);
  }

  return null;
}

export function buildSyncedGameLocation(
  currentHref: string,
  gameId: string | null | undefined
): string {
  const url = new URL(currentHref);

  if (gameId) {
    return "/game/" + encodeURIComponent(gameId);
  }

  if (url.pathname !== "/game") {
    return "/game";
  }

  url.searchParams.delete("gameId");
  return url.pathname + url.search + url.hash;
}
