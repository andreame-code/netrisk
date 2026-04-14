import { createModuleRegistry } from "../../module-registry.cjs";
import { commandSiteTheme } from "./command.cjs";
import { emberSiteTheme } from "./ember.cjs";
import { midnightSiteTheme } from "./midnight.cjs";
import type { SiteTheme, SiteThemeSummary } from "./types.cjs";

export const DEFAULT_SITE_THEME_ID = "command";

const siteThemeRegistry = createModuleRegistry<SiteTheme>([
  commandSiteTheme,
  midnightSiteTheme,
  emberSiteTheme
]);

export function findSiteTheme(themeId: string | null | undefined): Readonly<SiteTheme> | null {
  return siteThemeRegistry.find(themeId);
}

export function getSiteTheme(themeId: string = DEFAULT_SITE_THEME_ID): Readonly<SiteTheme> {
  return siteThemeRegistry.get(themeId, DEFAULT_SITE_THEME_ID);
}

export function listSiteThemes(): SiteThemeSummary[] {
  return siteThemeRegistry.entries.map((theme) => ({
    id: theme.id,
    name: theme.name,
    labelKey: theme.labelKey
  }));
}

export {
  commandSiteTheme,
  emberSiteTheme,
  midnightSiteTheme
};

export type {
  SiteTheme,
  SiteThemeSummary
};
