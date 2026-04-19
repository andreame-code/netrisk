import { setMarkup } from "./core/dom.mjs";
import type { MessagePayload, TranslationParams } from "./core/types.mjs";
import { it } from "./locales/it.mjs";
import { en } from "./locales/en.mjs";

export const SUPPORTED_LOCALES = Object.freeze(["it", "en"]);
export const DEFAULT_LOCALE = "it";
export const LOCALE_STORAGE_KEY = "netrisk.locale";

const dictionaries = Object.freeze({
  it,
  en
});

type LocaleCode = keyof typeof dictionaries;
type LocaleDictionary = Record<string, string>;
type LocaleOptions = {
  searchParams?: URLSearchParams | null;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  applyDocument?: boolean;
  locale?: string | null;
  fallback?: string;
};

function normalizeLocale(input: unknown): LocaleCode | null {
  if (!input) {
    return null;
  }

  const normalized = String(input).trim().toLowerCase().replace("_", "-");
  if (!normalized) {
    return null;
  }

  const directMatch = SUPPORTED_LOCALES.find((locale) => locale === normalized) as
    | LocaleCode
    | undefined;
  if (directMatch) {
    return directMatch;
  }

  const baseLocale = normalized.split("-")[0];
  return (
    (SUPPORTED_LOCALES.find((locale) => locale === baseLocale) as LocaleCode | undefined) || null
  );
}

function browserLocale(): LocaleCode | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const candidates: string[] = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  candidates.push(navigator.language);

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function isSupportedLocale(locale: unknown): boolean {
  return Boolean(normalizeLocale(locale));
}

export function getLocaleDictionary(locale: string = DEFAULT_LOCALE): LocaleDictionary {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
  return dictionaries[normalized] as LocaleDictionary;
}

export function getLocale(): LocaleCode {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  return normalizeLocale(window.__netriskLocale) || DEFAULT_LOCALE;
}

export function resolveLocale(options: LocaleOptions = {}): LocaleCode {
  const searchParams =
    options.searchParams ||
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null);
  const requested =
    searchParams && typeof searchParams.get === "function" ? searchParams.get("lang") : null;
  const fromQuery = normalizeLocale(requested);
  if (fromQuery) {
    return fromQuery;
  }

  const storage = options.storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (storage && typeof storage.getItem === "function") {
    const fromStorage = normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
    if (fromStorage) {
      return fromStorage;
    }
  }

  return browserLocale() || DEFAULT_LOCALE;
}

export function setLocale(
  locale: string | null | undefined,
  options: LocaleOptions = {}
): LocaleCode {
  const normalized = normalizeLocale(locale);
  const nextLocale = normalized || DEFAULT_LOCALE;

  if (typeof window !== "undefined") {
    window.__netriskLocale = nextLocale;
  }

  const storage = options.storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (storage && typeof storage.setItem === "function") {
    storage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  }

  if (options.applyDocument !== false && typeof document !== "undefined") {
    document.documentElement.lang = nextLocale;
  }

  return nextLocale;
}

function interpolate(template: string, params: TranslationParams = {}): string {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

export function t(
  key: string,
  params: TranslationParams = {},
  options: LocaleOptions = {}
): string {
  const requestedLocale = options.locale || getLocale();
  const dictionary = getLocaleDictionary(requestedLocale);
  const fallbackDictionary = getLocaleDictionary(DEFAULT_LOCALE);

  const template =
    dictionary[key as keyof LocaleDictionary] ?? fallbackDictionary[key as keyof LocaleDictionary];
  if (template == null) {
    return options.fallback ?? key;
  }

  return interpolate(template, params);
}

export function formatDate(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  locale = getLocale()
): string {
  if (!value) {
    return "";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, options).format(parsed);
}

export function listSupportedLocales() {
  return SUPPORTED_LOCALES.slice();
}

export function translateMessagePayload(payload: unknown, fallback = ""): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const messagePayload = payload as MessagePayload;
  const messageKey =
    messagePayload.messageKey || messagePayload.errorKey || messagePayload.reasonKey || null;
  const messageParams =
    messagePayload.messageParams || messagePayload.errorParams || messagePayload.reasonParams || {};
  if (messageKey) {
    return t(messageKey, messageParams as TranslationParams, {
      fallback: messagePayload.error || messagePayload.message || messagePayload.reason || fallback
    });
  }

  return messagePayload.error || messagePayload.message || messagePayload.reason || fallback;
}

export function translateServerMessage(payload: unknown, fallback = ""): string {
  return translateMessagePayload(payload, fallback);
}

export function translateGameLogEntries(
  snapshot: unknown
): string[] {
  const snapshotRecord =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : null;
  const logEntries = snapshotRecord?.logEntries;
  const legacyLog = snapshotRecord?.log;

  const localizedEntries = Array.isArray(logEntries)
    ? logEntries
        .map((entry) => translateMessagePayload(entry, entry?.message || ""))
        .filter(Boolean)
    : [];
  const legacyEntries = Array.isArray(legacyLog)
    ? legacyLog.filter((entry): entry is string => typeof entry === "string" && Boolean(entry))
    : [];

  if (!localizedEntries.length) {
    return legacyEntries;
  }

  if (!legacyEntries.length) {
    return localizedEntries;
  }

  const mergedEntries = localizedEntries.slice();
  const seenEntries = new Set(localizedEntries);
  for (const entry of legacyEntries) {
    if (seenEntries.has(entry)) {
      continue;
    }

    mergedEntries.push(entry);
    seenEntries.add(entry);
  }

  return mergedEntries;
}

export function applyTranslations(root: ParentNode = document, locale = getLocale()): void {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.textContent = t(translatedElement.dataset.i18n || "", {}, { locale });
  });

  root.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    setMarkup(translatedElement, t(translatedElement.dataset.i18nHtml || "", {}, { locale }));
  });

  root.querySelectorAll("[data-i18n-content]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.setAttribute(
      "content",
      t(translatedElement.dataset.i18nContent || "", {}, { locale })
    );
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.setAttribute(
      "placeholder",
      t(translatedElement.dataset.i18nPlaceholder || "", {}, { locale })
    );
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.setAttribute(
      "aria-label",
      t(translatedElement.dataset.i18nAriaLabel || "", {}, { locale })
    );
  });

  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.setAttribute(
      "title",
      t(translatedElement.dataset.i18nTitle || "", {}, { locale })
    );
  });

  root.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    const translatedElement = element as HTMLElement;
    translatedElement.setAttribute(
      "alt",
      t(translatedElement.dataset.i18nAlt || "", {}, { locale })
    );
  });
}
