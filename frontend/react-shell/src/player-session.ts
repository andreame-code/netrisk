const PLAYER_ID_STORAGE_KEY = "frontline-player-id";
type StoredPlayerSession = {
  gameId: string;
  playerId: string;
};

export function storeCurrentPlayerId(
  playerId: string | null | undefined,
  gameId?: string | null
): void {
  try {
    if (playerId && gameId) {
      window.localStorage.setItem(
        PLAYER_ID_STORAGE_KEY,
        JSON.stringify({
          gameId,
          playerId
        } satisfies StoredPlayerSession)
      );
      return;
    }

    window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
  } catch {
    // Preserve navigation behavior even if storage is unavailable.
  }
}

export function readCurrentPlayerId(gameId?: string | null): string | null {
  try {
    const rawValue = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const normalizedValue = rawValue.trim();
    if (!normalizedValue) {
      return null;
    }

    const parsedValue = JSON.parse(normalizedValue) as Partial<StoredPlayerSession> | string | null;
    if (typeof parsedValue === "string") {
      return parsedValue.trim() || null;
    }

    if (
      !parsedValue ||
      typeof parsedValue.playerId !== "string" ||
      typeof parsedValue.gameId !== "string"
    ) {
      return null;
    }

    if (gameId && parsedValue.gameId !== gameId) {
      return null;
    }

    return parsedValue.playerId;
  } catch {
    const rawValue = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const normalizedValue = rawValue.trim();
    if (
      !normalizedValue ||
      normalizedValue.startsWith("{") ||
      normalizedValue.startsWith("[") ||
      normalizedValue.startsWith('"')
    ) {
      return null;
    }

    return normalizedValue;
  }
}

export function clearCurrentPlayerId(): void {
  storeCurrentPlayerId(null);
}
