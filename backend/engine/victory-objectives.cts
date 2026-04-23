import type { GameState } from "../../shared/models.cjs";

type RuntimeVictoryObjective = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  enabled?: unknown;
  type?: unknown;
  summary?: unknown;
};

type RuntimeVictoryModule = {
  id: string;
  name: string;
  objectives: RuntimeVictoryObjective[];
};

export type SnapshotVictoryObjective = {
  moduleId: string;
  moduleName: string;
  id: string;
  title: string;
  description: string;
  type: string;
  summary?: string;
};

function shuffle<T>(list: T[], random: () => number): T[] {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}

function resolveRuntimeVictoryModule(state: GameState): RuntimeVictoryModule | null {
  const rawModule = state.gameConfig?.victoryObjectiveModule;
  if (!rawModule || typeof rawModule !== "object") {
    return null;
  }

  const moduleRecord = rawModule as Record<string, unknown>;
  const moduleId = typeof moduleRecord.id === "string" ? moduleRecord.id.trim() : "";
  const selectedVictoryRuleSetId =
    typeof state.gameConfig?.victoryRuleSetId === "string"
      ? state.gameConfig.victoryRuleSetId
      : state.victoryRuleSetId;
  if (!moduleId || moduleId !== selectedVictoryRuleSetId) {
    return null;
  }

  const objectives = Array.isArray(moduleRecord.objectives)
    ? (moduleRecord.objectives as RuntimeVictoryObjective[])
    : [];
  const enabledObjectives = objectives.filter(
    (objective) => objective && objective.enabled !== false && typeof objective.id === "string"
  );
  if (!enabledObjectives.length) {
    return null;
  }

  return {
    id: moduleId,
    name: typeof moduleRecord.name === "string" && moduleRecord.name ? moduleRecord.name : moduleId,
    objectives: enabledObjectives
  };
}

function persistedVictoryObjectiveAssignment(
  state: GameState,
  playerId: string | null | undefined
): string | null {
  if (!playerId) {
    return null;
  }

  const assignments = state.gameConfig?.victoryObjectiveAssignments;
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return null;
  }

  const objectiveId = (assignments as Record<string, unknown>)[playerId];
  return typeof objectiveId === "string" && objectiveId ? objectiveId : null;
}

export function resolveAssignedVictoryObjectiveId(
  state: GameState,
  playerId: string | null | undefined
): string | null {
  const persistedAssignment = persistedVictoryObjectiveAssignment(state, playerId);
  if (persistedAssignment) {
    return persistedAssignment;
  }

  const module = resolveRuntimeVictoryModule(state);
  if (!module || !playerId || state.phase === "lobby") {
    return null;
  }

  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) {
    return null;
  }

  const objective = module.objectives[playerIndex % module.objectives.length];
  return typeof objective?.id === "string" ? objective.id : null;
}

export function getAssignedVictoryObjectiveForPlayer(
  state: GameState,
  playerId: string | null | undefined
): SnapshotVictoryObjective | null {
  const module = resolveRuntimeVictoryModule(state);
  const objectiveId = resolveAssignedVictoryObjectiveId(state, playerId);
  if (!module || !objectiveId) {
    return null;
  }

  const objective =
    module.objectives.find((entry) => typeof entry.id === "string" && entry.id === objectiveId) ||
    null;
  if (!objective || typeof objective.id !== "string") {
    return null;
  }

  const title =
    typeof objective.title === "string" && objective.title ? objective.title : objective.id;
  const description =
    typeof objective.description === "string" && objective.description
      ? objective.description
      : typeof objective.summary === "string" && objective.summary
        ? objective.summary
        : title;

  return {
    moduleId: module.id,
    moduleName: module.name,
    id: objective.id,
    title,
    description,
    type: typeof objective.type === "string" && objective.type ? objective.type : "objective",
    ...(typeof objective.summary === "string" && objective.summary
      ? { summary: objective.summary }
      : {})
  };
}

export function assignVictoryObjectives(state: GameState, random: () => number): void {
  const module = resolveRuntimeVictoryModule(state);
  if (!module) {
    return;
  }

  const shuffledObjectives = shuffle(module.objectives, random);
  const assignments: Record<string, string> = {};
  state.players.forEach((player, index) => {
    const objective = shuffledObjectives[index % shuffledObjectives.length];
    if (player.id && typeof objective?.id === "string") {
      assignments[player.id] = objective.id;
    }
  });

  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryObjectiveAssignments: assignments
  };
}
