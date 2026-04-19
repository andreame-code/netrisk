import { buildGamePath, currentShellNamespace } from "@react-shell/public-auth-paths";

export function buildLegacyGamePath(gameId: string): string {
  return `/legacy/game.html?gameId=${encodeURIComponent(gameId)}`;
}

export function openLegacyGame(gameId: string): void {
  window.location.assign(buildLegacyGamePath(gameId));
}

export function buildReactGamePath(gameId: string): string {
  return buildGamePath(gameId, currentShellNamespace());
}

export function openReactGame(gameId: string): void {
  window.location.assign(buildReactGamePath(gameId));
}
