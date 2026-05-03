import { getLocale, listSupportedLocales, setLocale, t } from "@frontend-i18n";

import { describe, expect, it } from "vitest";

describe("frontend i18n", () => {
  it("supports German locale selection and regional German codes", () => {
    expect(listSupportedLocales()).toContain("de");

    const resolvedLocale = setLocale("de-DE", {
      storage: window.localStorage,
      applyDocument: true
    });

    expect(resolvedLocale).toBe("de");
    expect(getLocale()).toBe("de");
    expect(document.documentElement.lang).toBe("de");
    expect(t("nav.localeLabel")).toBe("Sprache");
    expect(t("locale.label.de")).toBe("Deutsch");
  });
});
