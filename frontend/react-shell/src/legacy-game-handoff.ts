export function buildLegacyGamePath(gameId: string): string {
  return `/game/${encodeURIComponent(gameId)}`;
}

export function openLegacyGame(gameId: string): void {
  window.location.assign(buildLegacyGamePath(gameId));
}

export function buildReactGamePath(gameId: string): string {
  return `/react/game/${encodeURIComponent(gameId)}`;
}

export function openReactGame(gameId: string): void {
  window.location.assign(buildReactGamePath(gameId));
}
