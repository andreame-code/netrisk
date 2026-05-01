import { useMutation } from "@tanstack/react-query";

import type { GameMutationResponse } from "@frontend-generated/shared-runtime-validation.mts";
import { joinGame, sendGameAction, startGame, tradeCards } from "@frontend-core/api/client.mts";
import type { GameActionRequest, TradeCardsRequest } from "@frontend-core/api/client.mts";

type ApplyMutationPayload = (
  payload: GameMutationResponse,
  options?: { feedback?: string }
) => void;

type GameplayCommandsOptions = {
  gameId: string | null;
  playerId: string | null;
  currentVersion: number | null;
  requestFailedMessage: string;
  invalidPlayerMessage: string;
  tradeSuccessFeedback: (bonus: number) => string;
  applyMutationPayload: ApplyMutationPayload;
  handleMutationError: (error: unknown) => void;
};

function withExpectedVersion<TRequest extends Record<string, unknown>>(
  request: TRequest,
  currentVersion: number | null
): TRequest & { expectedVersion?: number } {
  return {
    ...request,
    ...(currentVersion ? { expectedVersion: currentVersion } : {})
  };
}

export function useGameplayCommands({
  gameId,
  playerId,
  currentVersion,
  requestFailedMessage,
  invalidPlayerMessage,
  tradeSuccessFeedback,
  applyMutationPayload,
  handleMutationError
}: GameplayCommandsOptions) {
  const clientMessages = {
    errorMessage: requestFailedMessage,
    fallbackMessage: requestFailedMessage
  };

  const joinMutation = useMutation({
    mutationFn: () => joinGame(gameId || "", clientMessages),
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const startMutation = useMutation({
    mutationFn: () => {
      if (!gameId || !playerId) {
        throw new Error(invalidPlayerMessage);
      }

      return startGame(
        withExpectedVersion(
          {
            gameId,
            playerId
          },
          currentVersion
        ),
        clientMessages
      );
    },
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const actionMutation = useMutation({
    mutationFn: (request: GameActionRequest) => sendGameAction(request, clientMessages),
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const tradeMutation = useMutation({
    mutationFn: (request: TradeCardsRequest) => tradeCards(request, clientMessages),
    onSuccess: (payload) =>
      applyMutationPayload(payload, {
        feedback: typeof payload.bonus === "number" ? tradeSuccessFeedback(payload.bonus) : ""
      }),
    onError: handleMutationError
  });

  return {
    join: () => joinMutation.mutateAsync(),
    start: () => startMutation.mutateAsync(),
    submitAction: (request: Omit<GameActionRequest, "expectedVersion">) =>
      actionMutation
        .mutateAsync(withExpectedVersion(request, currentVersion) as GameActionRequest)
        .then(() => undefined),
    trade: (request: Omit<TradeCardsRequest, "expectedVersion">) =>
      tradeMutation.mutateAsync(withExpectedVersion(request, currentVersion) as TradeCardsRequest),
    isJoining: joinMutation.isPending,
    isStarting: startMutation.isPending,
    isActionPending: actionMutation.isPending,
    isTrading: tradeMutation.isPending,
    isAnyPending:
      joinMutation.isPending ||
      startMutation.isPending ||
      actionMutation.isPending ||
      tradeMutation.isPending
  };
}
