const { createContinent, createGameState, createPlayer, createTerritory, TurnPhase } =
  require("../../../shared/models.cjs") as typeof import("../../../shared/models.cjs");
const { buildMapGraph } =
  require("../../../shared/map-graph.cjs") as typeof import("../../../shared/map-graph.cjs");
import type {
  Continent,
  GameState,
  Player,
  Territory,
  TurnPhaseValue
} from "../../../shared/models.cjs";

type TerritoryStateInput = Pick<Territory, "id"> & {
  ownerId?: string | null;
  armies?: number | null;
};

type StateOptions = {
  phase?: GameState["phase"];
  turnPhase?: TurnPhaseValue;
  players?: Player[];
  territories?: GameState["territories"];
  continents?: Continent[];
  currentTurnIndex?: number;
  reinforcementPool?: number;
  winnerId?: string | null;
  log?: GameState["log"];
  lastAction?: GameState["lastAction"];
  pendingConquest?: GameState["pendingConquest"];
  fortifyUsed?: boolean;
  attacksThisTurn?: number;
  fortifyMoveUsed?: boolean;
};

function makePlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return createPlayer({
    id,
    name,
    color:
      overrides.color ||
      "#" +
        String(id || "p1")
          .padEnd(6, "0")
          .slice(0, 6),
    connected: overrides.connected !== false,
    ...overrides
  });
}

function makePlayers(names: string[] = ["Alice", "Bob"]): Player[] {
  return names.map((name, index) => makePlayer(`p${index + 1}`, name));
}

function makeTerritory(
  id: string,
  neighbors: string[] = [],
  overrides: Partial<Territory> = {}
): Territory {
  return createTerritory({
    id,
    name: overrides.name || id.charAt(0).toUpperCase() + id.slice(1),
    neighbors,
    continentId: overrides.continentId || null,
    ownerId: overrides.ownerId || null,
    armies: overrides.armies == null ? 0 : overrides.armies,
    ...overrides
  });
}

function makeContinent(
  id: string,
  territoryIds: string[],
  bonus: number = 0,
  overrides: Partial<Continent> = {}
): Continent {
  return createContinent({
    id,
    name: overrides.name || id.charAt(0).toUpperCase() + id.slice(1),
    bonus,
    territoryIds,
    ...overrides
  });
}

function territoryStates(entries: TerritoryStateInput[]): GameState["territories"] {
  return entries.reduce(
    (accumulator, entry) => {
      const territoryId = String(entry.id || "");
      accumulator[territoryId] = {
        ownerId: entry.ownerId || null,
        armies: entry.armies == null ? 0 : entry.armies
      };
      return accumulator;
    },
    {} as GameState["territories"]
  );
}

function makeState(options: StateOptions = {}): GameState {
  const state = createGameState({
    phase: options.phase || "active",
    turnPhase: options.turnPhase || TurnPhase.REINFORCEMENT,
    players: options.players || makePlayers(),
    territories: options.territories || {},
    continents: options.continents || [],
    currentTurnIndex: options.currentTurnIndex || 0,
    reinforcementPool: options.reinforcementPool || 0,
    winnerId: options.winnerId || null,
    log: options.log || [],
    lastAction: options.lastAction || null,
    pendingConquest: options.pendingConquest || null,
    fortifyUsed: Boolean(options.fortifyUsed),
    attacksThisTurn: typeof options.attacksThisTurn === "number" ? options.attacksThisTurn : 0
  });
  (state as GameState & { fortifyMoveUsed?: boolean }).fortifyMoveUsed = Boolean(
    options.fortifyMoveUsed
  );
  return state;
}

function makeMapDefinition(territories: Territory[], continents: Continent[] = []) {
  return {
    territories: territories.map((territory) => ({
      territory,
      position: { x: 0.5, y: 0.5 }
    })),
    continents
  };
}

function makeGraph(territories: Territory[]) {
  return buildMapGraph(territories);
}

module.exports = {
  TurnPhase,
  makeContinent,
  makeGraph,
  makeMapDefinition,
  makePlayer,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates
};
