export const DEFAULT_THEME = "command";
export const SUPPORTED_THEMES = Object.freeze(["command", "midnight", "ember"]);

export function normalizeTheme(theme) {
  return SUPPORTED_THEMES.includes(theme) ? theme : DEFAULT_THEME;
}
