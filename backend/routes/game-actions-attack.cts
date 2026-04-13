type SendJson = (res: unknown, statusCode: number, payload: unknown, headers?: Record<string, string>) => void;
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
type ResolveAttack = (
  state: any,
  playerId: string,
  fromId: string,
  toId: string,
  random?: (() => number) | null,
  attackDice?: number | null
) => any;
type ResolveBanzaiAttack = ResolveAttack;
type ConsumeQueuedAttackRandom = () => (() => number) | null;

function mappedAttackResolverError(error: unknown): { message: string; messageKey: string } | null {
  const runtimeMessage = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";

  if (!runtimeMessage) {
    return null;
  }

  if (runtimeMessage.indexOf("Attacker dice must be between 1 and") === 0) {
    return {
      message: "Numero di dadi di attacco non valido.",
      messageKey: "game.attack.invalidDiceCount"
    };
  }

  if (
    runtimeMessage.indexOf("Defender dice must be between 1 and") === 0 ||
    runtimeMessage === "Combat resolution requires attacker and defender territory state."
  ) {
    return {
      message: "Territori non validi.",
      messageKey: "game.attack.invalidTerritories"
    };
  }

  return null;
}

async function handleAttackGameActionRoute(
  type: string,
  res: unknown,
  body: Record<string, any>,
  gameContext: any,
  playerId: string,
  expectedVersion: number | null,
  user: unknown,
  resolveAttack: ResolveAttack,
  resolveBanzaiAttack: ResolveBanzaiAttack,
  consumeQueuedAttackRandom: ConsumeQueuedAttackRandom,
  persistGameContext: PersistGameContext,
  broadcastGame: BroadcastGame,
  snapshotForUser: SnapshotForUser,
  handleVersionConflict: HandleVersionConflict,
  isValidTerritoryId: IsValidTerritoryId,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<boolean> {
  if (type !== "attack" && type !== "attackBanzai") {
    return false;
  }

  const random = consumeQueuedAttackRandom() || undefined;
  const requestedAttackDice = body.attackDice == null || body.attackDice === "" ? null : Number(body.attackDice);
  const actionFromId = String(body.fromId || "");
  const actionToId = String(body.toId || "");
  if (!isValidTerritoryId(actionFromId) || !isValidTerritoryId(actionToId)) {
    sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
    return true;
  }

  let result;
  try {
    result = type === "attackBanzai"
      ? resolveBanzaiAttack(gameContext.state, playerId, actionFromId, actionToId, random, requestedAttackDice)
      : resolveAttack(gameContext.state, playerId, actionFromId, actionToId, random, requestedAttackDice);
  } catch (error) {
    const mappedError = mappedAttackResolverError(error);
    if (!mappedError) {
      throw error;
    }

    sendLocalizedError(res, 400, error, mappedError.message, mappedError.messageKey);
    return true;
  }

  if (!result.ok) {
    sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
    return true;
  }

  try {
    await persistGameContext(gameContext, expectedVersion);
  } catch (error) {
    if (handleVersionConflict(error)) {
      return true;
    }
    throw error;
  }
  broadcastGame(gameContext);
  sendJson(res, 200, {
    ok: true,
    state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, user),
    rounds: Array.isArray(result.rounds) ? result.rounds : undefined
  });
  return true;
}

module.exports = {
  handleAttackGameActionRoute
};
