const { persistBroadcastAndSendMutation } = require("./game-mutation.cjs");

type SendJson = (
  res: unknown,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;
type SendLocalizedError = (
  res: unknown,
  statusCode: number,
  error: any,
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, unknown>,
  code?: string,
  extraPayload?: Record<string, unknown>
) => void;

type PersistWithAiTurns = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;
type HandleVersionConflict = (error: unknown) => boolean;
type EndTurn = (state: any, playerId: string) => any;
type SurrenderPlayer = (state: any, playerId: string) => any;

async function handleTurnGameActionRoute(
  type: string,
  res: unknown,
  gameContext: any,
  playerId: string,
  expectedVersion: number | null,
  user: unknown,
  endTurn: EndTurn,
  surrenderPlayer: SurrenderPlayer,
  persistWithAiTurns: PersistWithAiTurns,
  broadcastGame: BroadcastGame,
  snapshotForUser: SnapshotForUser,
  handleVersionConflict: HandleVersionConflict,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<boolean> {
  if (type === "endTurn") {
    const result = endTurn(gameContext.state, playerId);
    if (!result.ok) {
      sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
      return true;
    }

    await persistBroadcastAndSendMutation({
      res,
      gameContext,
      expectedVersion,
      user,
      persistGameContext: persistWithAiTurns,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      sendJson,
      sendLocalizedError
    });
    return true;
  }

  if (type === "surrender") {
    const result = surrenderPlayer(gameContext.state, playerId);
    if (!result.ok) {
      sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
      return true;
    }

    await persistBroadcastAndSendMutation({
      res,
      gameContext,
      expectedVersion,
      user,
      persistGameContext: persistWithAiTurns,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      sendJson,
      sendLocalizedError
    });
    return true;
  }

  return false;
}

module.exports = {
  handleTurnGameActionRoute
};
