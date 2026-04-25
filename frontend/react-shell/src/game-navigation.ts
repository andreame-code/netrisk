import { buildGamePath, currentShellNamespace } from "@react-shell/public-auth-paths";

export function buildShellGamePath(gameId: string): string {
  return buildGamePath(gameId, currentShellNamespace());
}

export function openShellGame(gameId: string): void {
  window.location.assign(buildShellGamePath(gameId));
}
