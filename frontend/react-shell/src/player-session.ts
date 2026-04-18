const PLAYER_ID_STORAGE_KEY = "frontline-player-id";

export function storeCurrentPlayerId(playerId: string | null | undefined): void {
  try {
    if (playerId) {
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
      return;
    }

    window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
  } catch {
    // Preserve navigation behavior even if storage is unavailable.
  }
}

export function readCurrentPlayerId(): string | null {
  try {
    return window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearCurrentPlayerId(): void {
  storeCurrentPlayerId(null);
}
