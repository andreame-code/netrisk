import {
  DEFAULT_THEME,
  findTheme,
  normalizeTheme,
  registeredThemes
} from "@frontend-core/contracts.mts";
import { t } from "@frontend-i18n";

const THEME_STORAGE_KEY = "netrisk.theme";

export const shellThemes = registeredThemes;

function readStoredTheme(): string | null {
  try {
    return window.localStorage?.getItem(THEME_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function currentShellTheme(): string {
  if (typeof document === "undefined") {
    return normalizeTheme(readStoredTheme() || DEFAULT_THEME);
  }

  return normalizeTheme(
    document.documentElement.dataset.theme || readStoredTheme() || DEFAULT_THEME
  );
}

export function applyShellTheme(theme: string | null | undefined): string {
  const nextTheme = normalizeTheme(theme || currentShellTheme());
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = nextTheme;
    if (document.body) {
      document.body.dataset.theme = nextTheme;
    }
  }

  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Keep the resolved theme applied even when storage is unavailable.
  }

  return nextTheme;
}

export function themeLabel(theme: string): string {
  const themeDefinition = findTheme(theme);
  return themeDefinition ? t(themeDefinition.labelKey) : theme;
}
