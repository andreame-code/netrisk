import { useEffect, useEffectEvent, useState } from "react";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import type { GameStateResponse } from "@frontend-generated/shared-runtime-validation.mts";

import { subscribeToGameEvents } from "@frontend-core/api/client.mts";

import { storeCurrentPlayerId } from "@react-shell/player-session";

export type GameEventStreamStatus = "connecting" | "live" | "reconnecting";

type UseGameEventStreamOptions = {
  enabled?: boolean;
  gameId: string | null | undefined;
  queryKey: QueryKey;
};

export function useGameEventStream({
  enabled = true,
  gameId,
  queryKey
}: UseGameEventStreamOptions): GameEventStreamStatus {
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<GameEventStreamStatus>("connecting");
  const cachedState = queryClient.getQueryData<GameStateResponse>(queryKey);
  const resolvedGameId = enabled ? cachedState?.gameId || gameId || "" : "";

  const handleEventMessage = useEffectEvent((nextPayload: GameStateResponse) => {
    setStreamStatus("live");
    queryClient.setQueryData(queryKey, nextPayload);
    if (nextPayload.playerId) {
      storeCurrentPlayerId(nextPayload.playerId, nextPayload.gameId || resolvedGameId || null);
    }
    setStreamStatus("live");
  });

  useEffect(() => {
    if (!resolvedGameId) {
      return;
    }

    setStreamStatus("connecting");
    const eventSource = subscribeToGameEvents({
      gameId: resolvedGameId,
      onOpen: () => {
        setStreamStatus("live");
      },
      onMessage: handleEventMessage,
      onInvalidPayload: () => {
        setStreamStatus("reconnecting");
      },
      onError: () => {
        setStreamStatus((current) => (current === "live" ? "reconnecting" : current));
      }
    });

    return () => {
      eventSource.close();
    };
  }, [resolvedGameId]);

  return streamStatus;
}
