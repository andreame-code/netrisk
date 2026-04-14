export interface ThemeDefinition {
  id: string;
  labelKey: string;
}

export const registeredThemes = Object.freeze<readonly ThemeDefinition[]>([
  Object.freeze({ id: "command", labelKey: "profile.preferences.theme.command" }),
  Object.freeze({ id: "midnight", labelKey: "profile.preferences.theme.midnight" }),
  Object.freeze({ id: "ember", labelKey: "profile.preferences.theme.ember" })
]);

export const DEFAULT_THEME = "command";

export type ThemeName = string;

export function findTheme(theme: string | null | undefined): ThemeDefinition | null {
  if (!theme) {
    return null;
  }

  return registeredThemes.find((entry) => entry.id === theme) || null;
}

export function listThemeIds(): string[] {
  return registeredThemes.map((theme) => theme.id);
}

export function normalizeTheme(theme: string | null | undefined): ThemeName {
  return findTheme(theme)?.id || DEFAULT_THEME;
}
