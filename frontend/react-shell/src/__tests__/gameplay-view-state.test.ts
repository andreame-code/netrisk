import { describe, expect, it } from "vitest";

import type { GameSnapshot } from "@frontend-generated/shared-runtime-validation.mts";

import { buildGameplayViewState } from "@react-shell/gameplay-view-state";

function activeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    gameId: "game-1",
    version: 7,
    phase: "active",
    turnPhase: "attack",
    currentPlayerId: "p1",
    winnerId: null,
    players: [
      { id: "p1", name: "Alice", color: "#f00" },
      { id: "p2", name: "Bob", color: "#00f" }
    ],
    map: [
      { id: "a", name: "Alpha", ownerId: "p1", armies: 4, neighbors: ["b"] },
      { id: "b", name: "Beta", ownerId: "p2", armies: 2, neighbors: ["a"] }
    ],
    reinforcementPool: 0,
    playerHand: [],
    ...overrides
  };
}

describe("buildGameplayViewState", () => {
  it("indexes players and exposes current player command state", () => {
    const viewState = buildGameplayViewState(activeSnapshot(), "p1");

    expect(viewState.playersById.p1?.name).toBe("Alice");
    expect(viewState.territoriesById.a?.armies).toBe(4);
    expect(viewState.me?.id).toBe("p1");
    expect(viewState.activePlayer?.id).toBe("p1");
    expect(viewState.myTerritories.map((territory) => territory.id)).toEqual(["a"]);
    expect(viewState.currentVersion).toBe(7);
    expect(viewState.isMyTurn).toBe(true);
    expect(viewState.showAttackGroup).toBe(true);
    expect(viewState.showEndTurn).toBe(true);
    expect(viewState.showSurrender).toBe(true);
  });

  it("blocks attack commands while conquest movement is pending", () => {
    const viewState = buildGameplayViewState(
      activeSnapshot({
        pendingConquest: {
          fromId: "a",
          toId: "b",
          minArmies: 1,
          maxArmies: 3
        }
      }),
      "p1"
    );

    expect(viewState.showAttackGroup).toBe(false);
    expect(viewState.showConquestGroup).toBe(true);
  });

  it("detects mandatory card trade presentation state", () => {
    const viewState = buildGameplayViewState(
      activeSnapshot({
        turnPhase: "reinforcement",
        reinforcementPool: 3,
        cardState: {
          currentPlayerMustTrade: true,
          currentPlayerCardCount: 6
        },
        playerHand: [
          { id: "c1", territoryId: "a", type: "infantry" },
          { id: "c2", territoryId: "b", type: "cavalry" }
        ]
      }),
      "p1"
    );

    expect(viewState.mustTradeCards).toBe(true);
    expect(viewState.showReinforceGroup).toBe(true);
  });
});
