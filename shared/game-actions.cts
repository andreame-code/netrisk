export const GameAction = Object.freeze({
  JOIN: "join",
  START: "start",
  REINFORCE: "reinforce",
  ATTACK: "attack",
  END_TURN: "endTurn",
  SURRENDER: "surrender"
} as const);

export type GameActionValue = (typeof GameAction)[keyof typeof GameAction];
