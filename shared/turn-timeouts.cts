export const TURN_TIMEOUT_HOURS_OPTIONS = Object.freeze([24, 48, 72] as const);

export type TurnTimeoutHoursValue = (typeof TURN_TIMEOUT_HOURS_OPTIONS)[number];

export function normalizeTurnTimeoutHours(value: unknown): TurnTimeoutHoursValue | null {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue)) {
    return null;
  }

  return TURN_TIMEOUT_HOURS_OPTIONS.includes(numericValue as TurnTimeoutHoursValue)
    ? (numericValue as TurnTimeoutHoursValue)
    : null;
}
