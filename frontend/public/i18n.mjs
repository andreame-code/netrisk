import { it } from "./locales/it.mjs";
import { en } from "./locales/en.mjs";

export const SUPPORTED_LOCALES = Object.freeze(["it", "en"]);
export const DEFAULT_LOCALE = "it";
export const LOCALE_STORAGE_KEY = "netrisk.locale";

const dictionaries = Object.freeze({
  it,
  en
});

function normalizeLocale(input) {
  if (!input) {
    return null;
  }

  const normalized = String(input).trim().toLowerCase().replace("_", "-");
  if (!normalized) {
    return null;
  }

  const directMatch = SUPPORTED_LOCALES.find((locale) => locale === normalized);
  if (directMatch) {
    return directMatch;
  }

  const baseLocale = normalized.split("-")[0];
  return SUPPORTED_LOCALES.find((locale) => locale === baseLocale) || null;
}

function browserLocale() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const candidates = [];
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

export function isSupportedLocale(locale) {
  return Boolean(normalizeLocale(locale));
}

export function getLocaleDictionary(locale = DEFAULT_LOCALE) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
  return dictionaries[normalized] || dictionaries[DEFAULT_LOCALE];
}

export function getLocale() {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  return normalizeLocale(window.__netriskLocale) || DEFAULT_LOCALE;
}

export function resolveLocale(options = {}) {
  const searchParams = options.searchParams
    || (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null);
  const requested = searchParams && typeof searchParams.get === "function"
    ? searchParams.get("lang")
    : null;
  const fromQuery = normalizeLocale(requested);
  if (fromQuery) {
    return fromQuery;
  }

  const storage = options.storage
    || (typeof window !== "undefined" ? window.localStorage : null);
  if (storage && typeof storage.getItem === "function") {
    const fromStorage = normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
    if (fromStorage) {
      return fromStorage;
    }
  }

  return browserLocale() || DEFAULT_LOCALE;
}

export function setLocale(locale, options = {}) {
  const normalized = normalizeLocale(locale);
  const nextLocale = normalized || DEFAULT_LOCALE;

  if (typeof window !== "undefined") {
    window.__netriskLocale = nextLocale;
  }

  const storage = options.storage
    || (typeof window !== "undefined" ? window.localStorage : null);
  if (storage && typeof storage.setItem === "function") {
    storage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  }

  if (options.applyDocument !== false && typeof document !== "undefined") {
    document.documentElement.lang = nextLocale;
  }

  return nextLocale;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  ));
}

export function t(key, params = {}, options = {}) {
  const requestedLocale = options.locale || getLocale();
  const dictionary = getLocaleDictionary(requestedLocale);
  const fallbackDictionary = getLocaleDictionary(DEFAULT_LOCALE);

  const template = dictionary[key] ?? fallbackDictionary[key];
  if (template == null) {
    return options.fallback ?? key;
  }

  return interpolate(template, params);
}

export function formatDate(value, options = {}, locale = getLocale()) {
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

export function translateMessagePayload(payload, fallback = "") {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const messageKey = payload.messageKey || payload.errorKey || payload.reasonKey || null;
  const messageParams = payload.messageParams || payload.errorParams || payload.reasonParams || {};
  if (messageKey) {
    return t(messageKey, messageParams, { fallback: payload.error || payload.message || payload.reason || fallback });
  }

  return payload.error || payload.message || payload.reason || fallback;
}

export function translateServerMessage(payload, fallback = "") {
  return translateMessagePayload(payload, fallback);
}

export function translateGameLogEntries(snapshot) {
  const localizedEntries = Array.isArray(snapshot?.logEntries)
    ? snapshot.logEntries
      .map((entry) => translateMessagePayload(entry, entry?.message || ""))
      .filter(Boolean)
    : [];
  const legacyEntries = Array.isArray(snapshot?.log)
    ? snapshot.log.filter(Boolean)
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

export function applyTranslations(root = document, locale = getLocale()) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n, {}, { locale });
  });

  root.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml, {}, { locale });
  });

  root.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.setAttribute("content", t(element.dataset.i18nContent, {}, { locale }));
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder, {}, { locale }));
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel, {}, { locale }));
  });

  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", t(element.dataset.i18nTitle, {}, { locale }));
  });

  root.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.setAttribute("alt", t(element.dataset.i18nAlt, {}, { locale }));
  });
}
