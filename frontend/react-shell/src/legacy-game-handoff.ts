import { buildGamePath, currentShellNamespace } from "@react-shell/public-auth-paths";

export function buildReactGamePath(gameId: string): string {
  return buildGamePath(gameId, currentShellNamespace());
}

export function openReactGame(gameId: string): void {
  window.location.assign(buildReactGamePath(gameId));
}
