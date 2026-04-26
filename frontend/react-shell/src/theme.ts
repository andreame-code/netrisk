import {
  DEFAULT_THEME,
  findTheme,
  normalizeTheme,
  registeredThemes
} from "@frontend-core/contracts.mts";
import { t } from "@frontend-i18n";

const THEME_STORAGE_KEY = "netrisk.theme";
let availableShellThemeIds = registeredThemes.map((theme) => theme.id);
let availableShellThemeDefinitions = new Map<
  string,
  {
    labelKey?: string | null;
    name?: string | null;
  }
>();
type ThemePreferenceUser = { preferences?: { theme?: string | null } | null } | null | undefined;
type RuntimeThemeDefinition = {
  id?: string | null;
  labelKey?: string | null;
  name?: string | null;
};

function normalizeThemeEntries(themes: Array<string | RuntimeThemeDefinition> | null | undefined): {
  ids: string[];
  definitions: Map<string, RuntimeThemeDefinition>;
} {
  const definitions = new Map<string, RuntimeThemeDefinition>();
  const nextThemes = Array.isArray(themes)
    ? themes
        .map((entry) => {
          const id = typeof entry === "string" ? entry : String(entry?.id || "");
          if (id && typeof entry !== "string") {
            definitions.set(id, {
              labelKey: entry.labelKey || null,
              name: entry.name || null
            });
          }
          return id;
        })
        .filter(Boolean)
    : [];

  return {
    ids: nextThemes.length ? [...new Set(nextThemes)] : registeredThemes.map((theme) => theme.id),
    definitions
  };
}

export function setAvailableShellThemes(
  themes: Array<string | RuntimeThemeDefinition> | null | undefined
): string[] {
  const normalized = normalizeThemeEntries(themes);
  availableShellThemeIds = normalized.ids;
  availableShellThemeDefinitions = normalized.definitions;
  return listAvailableShellThemeIds();
}

function listAvailableShellThemeIds(): string[] {
  const currentTheme = currentShellTheme();
  return availableShellThemeIds.includes(currentTheme)
    ? [...availableShellThemeIds]
    : [currentTheme, ...availableShellThemeIds];
}

export function listShellThemes(): Array<{ id: string }> {
  return listAvailableShellThemeIds().map((id) => ({ id }));
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage?.getItem(THEME_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function applyStoredRegisteredShellTheme(): string | null {
  const storedTheme = readStoredTheme();
  if (!storedTheme || !registeredThemes.some((theme) => theme.id === storedTheme)) {
    return null;
  }

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = storedTheme;
    if (document.body) {
      document.body.dataset.theme = storedTheme;
    }
  }

  return storedTheme;
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
  if (themeDefinition) {
    return t(themeDefinition.labelKey);
  }

  const runtimeThemeDefinition = availableShellThemeDefinitions.get(theme);
  if (runtimeThemeDefinition?.labelKey) {
    return t(runtimeThemeDefinition.labelKey);
  }

  return runtimeThemeDefinition?.name || theme;
}

export function installShellThemeBridge(): void {
  window.netriskTheme = Object.freeze({
    defaultTheme: DEFAULT_THEME,
    storageKey: THEME_STORAGE_KEY,
    getThemes() {
      return listAvailableShellThemeIds();
    },
    setThemes(themes: Array<string | RuntimeThemeDefinition>) {
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
