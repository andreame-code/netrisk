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

type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;
type HandleVersionConflict = (error: unknown) => boolean;
type IsValidTerritoryId = (id: string) => boolean;
type ApplyReinforcement = (
  state: any,
  playerId: string,
  territoryId: string,
  amount: unknown
) => any;
type MoveAfterConquest = (state: any, playerId: string, armies: unknown) => any;
type ApplyFortify = (
  state: any,
  playerId: string,
  fromId: string,
  toId: string,
  armies: unknown
) => any;

async function handleBasicGameActionRoute(
  type: string,
  res: unknown,
  body: Record<string, any>,
  gameContext: any,
  playerId: string,
  expectedVersion: number | null,
  user: unknown,
  applyReinforcement: ApplyReinforcement,
  moveAfterConquest: MoveAfterConquest,
  applyFortify: ApplyFortify,
  persistGameContext: PersistGameContext,
  broadcastGame: BroadcastGame,
  snapshotForUser: SnapshotForUser,
  handleVersionConflict: HandleVersionConflict,
  isValidTerritoryId: IsValidTerritoryId,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<boolean> {
  if (type === "reinforce") {
    const territoryId = String(body.territoryId || "");
    if (!isValidTerritoryId(territoryId)) {
      sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
      return true;
    }
    const result = applyReinforcement(gameContext.state, playerId, territoryId, body.amount);
    if (!result.ok) {
      sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
      return true;
    }

    await persistBroadcastAndSendMutation({
      res,
      gameContext,
      expectedVersion,
      user,
      persistGameContext,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      sendJson,
      sendLocalizedError
    });
    return true;
  }

  if (type === "moveAfterConquest") {
    const result = moveAfterConquest(gameContext.state, playerId, body.armies);
    if (!result.ok) {
      sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
      return true;
    }

    await persistBroadcastAndSendMutation({
      res,
      gameContext,
      expectedVersion,
      user,
      persistGameContext,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      sendJson,
      sendLocalizedError
    });
    return true;
  }

  if (type === "fortify") {
    const fortifyFromId = String(body.fromId || "");
    const fortifyToId = String(body.toId || "");
    if (!isValidTerritoryId(fortifyFromId) || !isValidTerritoryId(fortifyToId)) {
      sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
      return true;
    }
    const result = applyFortify(
      gameContext.state,
      playerId,
      fortifyFromId,
      fortifyToId,
      body.armies
    );
    if (!result.ok) {
      sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
      return true;
    }

    await persistBroadcastAndSendMutation({
      res,
      gameContext,
      expectedVersion,
      user,
      persistGameContext,
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
  handleBasicGameActionRoute
};
