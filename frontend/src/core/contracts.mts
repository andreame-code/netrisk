export const DEFAULT_THEME = "command";
export const SUPPORTED_THEMES = Object.freeze(["command", "midnight", "ember"]);

export type ThemeName = (typeof SUPPORTED_THEMES)[number];

export function normalizeTheme(theme: string | null | undefined): ThemeName {
  return SUPPORTED_THEMES.includes(theme as ThemeName) ? (theme as ThemeName) : DEFAULT_THEME;
}
