import { applyTranslations, listSupportedLocales, resolveLocale, setLocale, t } from "./i18n.js";

const section = document.body.dataset.appSection || "";
const query = new URLSearchParams(window.location.search);
const pathGameMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
const currentGameId = pathGameMatch ? decodeURIComponent(pathGameMatch[1]) : query.get("gameId");
const activeLocale = setLocale(resolveLocale());

document.documentElement.lang = activeLocale;
applyTranslations(document, activeLocale);

const navLabels = {
  lobby: t("nav.lobby"),
  game: t("nav.game"),
  profile: t("nav.profile")
};

const navAriaLabel = t("nav.aria.primary");

function buildLocaleControl(container) {
  if (!container || container.querySelector("[data-locale-switcher]")) {
    return;
  }

  const wrapper = document.createElement("label");
  wrapper.className = "top-nav-locale";
  wrapper.dataset.localeSwitcher = "true";

  const text = document.createElement("span");
  text.className = "visually-hidden";
  text.textContent = t("nav.localeLabel");
  wrapper.appendChild(text);

  const select = document.createElement("select");
  select.className = "top-nav-locale-select";
  select.setAttribute("aria-label", t("nav.localeLabel"));

  listSupportedLocales().forEach((locale) => {
    const option = document.createElement("option");
    option.value = locale;
    option.textContent = t(`locale.label.${locale}`, {}, { fallback: locale.toUpperCase() });
    option.selected = locale === activeLocale;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const nextLocale = setLocale(select.value);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("lang", nextLocale);
    window.location.href = nextUrl.toString();
  });

  wrapper.appendChild(select);
  container.prepend(wrapper);
}

document.querySelectorAll("[data-nav-section]").forEach((link) => {
  const isActive = link.dataset.navSection === section;
  link.classList.toggle("is-active", isActive);
  link.setAttribute("aria-current", isActive ? "page" : "false");

  if (navLabels[link.dataset.navSection]) {
    link.textContent = navLabels[link.dataset.navSection];
  }

  if (link.dataset.navSection === "game" && currentGameId) {
    link.href = "/game/" + encodeURIComponent(currentGameId);
  }
});

document.querySelectorAll(".top-nav-links").forEach((nav) => {
  nav.setAttribute("aria-label", navAriaLabel);
});

document.querySelectorAll(".top-nav-actions").forEach((container) => {
  buildLocaleControl(container);
});
