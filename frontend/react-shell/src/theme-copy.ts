import { t } from "@frontend-i18n";

type ThemeCopyKey = "lobby.copy" | "lobby.heading";

const themeCopyKeys: Readonly<Record<string, Partial<Record<ThemeCopyKey, string>>>> =
  Object.freeze({
    "war-table": Object.freeze({
      "lobby.copy": "themeCopy.warTable.lobby.copy",
      "lobby.heading": "themeCopy.warTable.lobby.heading"
    })
  });

export function themeCopy(
  themeId: string | null | undefined,
  key: ThemeCopyKey,
  fallbackKey: string
): string {
  const overrideKey = themeId ? themeCopyKeys[themeId]?.[key] : null;
  return t(overrideKey || fallbackKey);
}
