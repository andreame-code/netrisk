interface NetRiskThemeManager {
  defaultTheme: string;
  storageKey?: string;
  getThemes(): string[];
  getCurrentTheme(): string;
  getThemeFromUser(user?: { preferences?: { theme?: string | null } | null } | null): string | null;
  applyUserTheme(user?: { preferences?: { theme?: string | null } | null } | null): string;
  applyTheme(theme: string): string;
  normalizeTheme(theme: string): string;
}

interface Window {
  __netriskLocale?: string;
  netriskTheme?: NetRiskThemeManager;
}
