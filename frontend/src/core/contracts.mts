export const DEFAULT_THEME = "command";
export const SUPPORTED_THEMES = Object.freeze(["command", "midnight", "ember"]);

export type ThemeName = string;

export function normalizeTheme(theme: string | null | undefined, supportedThemes: readonly string[] = SUPPORTED_THEMES): ThemeName {
  return supportedThemes.includes(String(theme || "")) ? String(theme) : DEFAULT_THEME;
}
