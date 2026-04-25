import {
  DEFAULT_THEME,
  findTheme,
  normalizeTheme,
  registeredThemes
} from "@frontend-core/contracts.mts";
import { t } from "@frontend-i18n";

const THEME_STORAGE_KEY = "netrisk.theme";
let availableShellThemeIds = registeredThemes.map((theme) => theme.id);
type ThemePreferenceUser = { preferences?: { theme?: string | null } | null } | null | undefined;

function normalizeThemeIds(
  themes: Array<string | { id?: string | null }> | null | undefined
): string[] {
  const nextThemes = Array.isArray(themes)
    ? themes
        .map((entry) => (typeof entry === "string" ? entry : String(entry?.id || "")))
        .filter(Boolean)
    : [];

  return nextThemes.length ? [...new Set(nextThemes)] : registeredThemes.map((theme) => theme.id);
}

export function setAvailableShellThemes(
  themes: Array<string | { id?: string | null }> | null | undefined
): string[] {
  availableShellThemeIds = normalizeThemeIds(themes);
  const currentTheme = currentShellTheme();
  return availableShellThemeIds.includes(currentTheme)
    ? [...availableShellThemeIds]
    : [currentTheme, ...availableShellThemeIds];
}

export function listShellThemes(): Array<{ id: string }> {
  return availableShellThemeIds.map((id) => ({ id }));
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage?.getItem(THEME_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function currentShellTheme(): string {
  if (typeof document === "undefined") {
    return normalizeTheme(readStoredTheme() || DEFAULT_THEME, availableShellThemeIds);
  }

  return normalizeTheme(
    document.documentElement.dataset.theme || readStoredTheme() || DEFAULT_THEME,
    availableShellThemeIds
  );
}

export function normalizeShellTheme(theme: string | null | undefined): string {
  return normalizeTheme(theme || currentShellTheme(), availableShellThemeIds);
}

export function applyShellTheme(theme: string | null | undefined): string {
  const nextTheme = normalizeShellTheme(theme);
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

export function installShellThemeBridge(): void {
  window.netriskTheme = Object.freeze({
    defaultTheme: DEFAULT_THEME,
    storageKey: THEME_STORAGE_KEY,
    getThemes() {
      return [...availableShellThemeIds];
    },
    setThemes(themes: Array<string | { id?: string | null }>) {
      return setAvailableShellThemes(themes);
    },
    getCurrentTheme() {
      return currentShellTheme();
    },
    getThemeFromUser(user: ThemePreferenceUser) {
      const requestedTheme = user?.preferences?.theme;
      return requestedTheme && availableShellThemeIds.includes(requestedTheme)
        ? requestedTheme
        : null;
    },
    applyUserTheme(user: ThemePreferenceUser) {
      return applyShellTheme(user?.preferences?.theme || null);
    },
    applyTheme(theme: string) {
      return applyShellTheme(theme);
    },
    normalizeTheme(theme: string) {
      return normalizeTheme(theme, availableShellThemeIds);
    }
  });
}
