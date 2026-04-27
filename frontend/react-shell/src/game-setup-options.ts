import type { GameOptionsResponse } from "@frontend-generated/shared-runtime-validation.mts";

const fallbackPlayerRange = {
  min: 2,
  max: 4
} as const;

const playerCountCandidates = [2, 3, 4, 5, 6] as const;
const fallbackTurnTimeoutHours = [24, 48, 72] as const;

type GameSetupOptions =
  | Pick<GameOptionsResponse, "playerRange" | "turnTimeoutHoursOptions">
  | null
  | undefined;

export function buildPlayerCountChoices(options: GameSetupOptions): number[] {
  const requestedMinimum = options?.playerRange?.min;
  const requestedMaximum = options?.playerRange?.max;
  const minimum =
    typeof requestedMinimum === "number" && Number.isInteger(requestedMinimum)
      ? requestedMinimum
      : fallbackPlayerRange.min;
  const maximum =
    typeof requestedMaximum === "number" && Number.isInteger(requestedMaximum)
      ? requestedMaximum
      : fallbackPlayerRange.max;
  const choices = playerCountCandidates.filter((value) => value >= minimum && value <= maximum);

  return choices.length
    ? [...choices]
    : playerCountCandidates.filter(
        (value) => value >= fallbackPlayerRange.min && value <= fallbackPlayerRange.max
      );
}

export function buildTurnTimeoutHourChoices(options: GameSetupOptions): number[] {
  const configured = options?.turnTimeoutHoursOptions?.filter((value) => Number.isInteger(value));

  return configured?.length ? configured.slice(0, 3) : [...fallbackTurnTimeoutHours];
}
