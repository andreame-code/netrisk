const PLAYER_ID_STORAGE_KEY = "frontline-player-id";
const PLAYER_ID_CHANGE_EVENT = "frontline-player-id-change";
type StoredPlayerSession = {
  gameId: string;
  playerId: string;
};
type StoredPlayerSessionWithGames = StoredPlayerSession & {
  games?: Record<string, string>;
};

function readStoredPlayerSession(): Partial<StoredPlayerSessionWithGames> | null {
  try {
    const rawValue = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredPlayerSessionWithGames> | null;
    return parsedValue && typeof parsedValue === "object" ? parsedValue : null;
  } catch {
    return null;
  }
}

function readPlayerSessionGames(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((games, [gameId, playerId]) => {
    if (gameId && typeof playerId === "string" && playerId) {
      games[gameId] = playerId;
    }

    return games;
  }, {});
}

function notifyCurrentPlayerIdChanged(): void {
  window.dispatchEvent(new Event(PLAYER_ID_CHANGE_EVENT));
}

export function subscribeCurrentPlayerIdChanges(listener: () => void): () => void {
  window.addEventListener(PLAYER_ID_CHANGE_EVENT, listener);
  return () => window.removeEventListener(PLAYER_ID_CHANGE_EVENT, listener);
}

export function storeCurrentPlayerId(
  playerId: string | null | undefined,
  gameId?: string | null
): void {
  try {
    if (playerId && gameId) {
      const games = readPlayerSessionGames(readStoredPlayerSession()?.games);
      games[gameId] = playerId;

      window.localStorage.setItem(
        PLAYER_ID_STORAGE_KEY,
        JSON.stringify({
          gameId,
          playerId,
          games
        } satisfies StoredPlayerSessionWithGames)
      );
      notifyCurrentPlayerIdChanged();
      return;
    }

    // When playerId is null/undefined, remove only the specific game mapping if gameId is provided,
    // otherwise clear everything. Do not clear all stored mappings when one game is opened as spectator.
    if (gameId) {
      const storedSession = readStoredPlayerSession();
      if (storedSession) {
        const games = readPlayerSessionGames(storedSession.games);
        delete games[gameId];

        const remainingGameIds = Object.keys(games);
        if (remainingGameIds.length > 0) {
          // Keep other game mappings but clear current gameId/playerId
          window.localStorage.setItem(
            PLAYER_ID_STORAGE_KEY,
            JSON.stringify({
              gameId: "",
              playerId: "",
              games
            } satisfies StoredPlayerSessionWithGames)
          );
        } else {
          window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
        }
        notifyCurrentPlayerIdChanged();
      }
      return;
    }

    window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
    notifyCurrentPlayerIdChanged();
  } catch {
    // Preserve navigation behavior even if storage is unavailable.
  }
}

export function readCurrentPlayerId(gameId?: string | null): string | null {
  try {
    const parsedValue = readStoredPlayerSession();
    if (!parsedValue) {
      return null;
    }

    if (gameId) {
      const storedPlayerId = readPlayerSessionGames(parsedValue.games)[gameId];
      if (storedPlayerId) {
        return storedPlayerId;
      }
    }

    // Ignore empty strings from partial cleanup cases.
    if (
      typeof parsedValue.playerId !== "string" ||
      !parsedValue.playerId ||
      typeof parsedValue.gameId !== "string" ||
      !parsedValue.gameId
    ) {
      return null;
    }

    if (gameId && parsedValue.gameId !== gameId) {
      return null;
    }

    return parsedValue.playerId;
  } catch {
    return null;
  }
}

export function clearCurrentPlayerId(): void {
  storeCurrentPlayerId(null);
}
