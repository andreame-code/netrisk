export function buildLegacyGamePath(gameId: string): string {
  return `/game/${encodeURIComponent(gameId)}`;
}

export function openLegacyGame(gameId: string): void {
  window.location.assign(buildLegacyGamePath(gameId));
}
