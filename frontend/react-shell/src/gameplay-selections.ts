type SelectionOption = {
  id: string;
};

export function selectOrFallback(
  selectedId: string | null | undefined,
  options: SelectionOption[],
  fallbackId: string | null = null
): string {
  if (selectedId && options.some((option) => option.id === selectedId)) {
    return selectedId;
  }

  if (fallbackId && options.some((option) => option.id === fallbackId)) {
    return fallbackId;
  }

  return options[0]?.id || "";
}

export function parsePositiveInteger(value: string, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeSelectNumber(
  value: string,
  minimum: number,
  maximum: number,
  fallbackValue: number
): string {
  if (maximum < minimum) {
    return "";
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return String(fallbackValue);
  }

  const parsed = Number(normalizedValue);
  if (!Number.isInteger(parsed)) {
    return String(fallbackValue);
  }

  return String(clamp(parsed, minimum, maximum));
}
