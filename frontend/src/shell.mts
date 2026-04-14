import { setMarkup } from "./core/dom.mjs";
import { DEFAULT_THEME, SUPPORTED_THEMES, normalizeTheme } from "./core/contracts.mjs";
import type { ThemeName } from "./core/contracts.mjs";
import { messageFromError } from "./core/errors.mjs";
import type { PublicUser } from "./core/types.mjs";
import { applyTranslations, listSupportedLocales, resolveLocale, setLocale, t, translateServerMessage } from "./i18n.mjs";

const THEME_STORAGE_KEY = "netrisk.theme";
const routeQuery = new URLSearchParams(window.location.search);
const shellKind = document.body.dataset.shellKind || (document.body.dataset.appSection ? "app" : "marketing");
const section = document.body.dataset.appSection || "";
const pathGameMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
const currentGameId = pathGameMatch ? decodeURIComponent(pathGameMatch[1]) : routeQuery.get("gameId");
const activeLocale = setLocale(resolveLocale());
let availableThemes = [...SUPPORTED_THEMES] as string[];

type ShellKind = "app" | "marketing";
type NavSection = "lobby" | "game" | "profile";
type LocaleControlOptions = {
  container: Element | null;
  marker: string;
  wrapperClass: string;
  labelClass: string;
  selectClass: string;
  labelMode?: "visible" | "hidden";
  position?: "prepend" | "append";
};

function setHeaderAuthFeedback(message = "", tone: "error" | "success" = "error"): void {
  const feedback = document.querySelector("#top-nav-auth-feedback") as HTMLElement | null;
  if (!feedback) {
    return;
  }

  if (!message) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.className = "auth-feedback top-nav-auth-feedback";
    return;
  }

  feedback.hidden = false;
  feedback.textContent = message;
  feedback.className = `auth-feedback top-nav-auth-feedback is-${tone}`;
}

function resolveThemeFromUser(user: PublicUser | null | undefined): ThemeName | null {
  const requestedTheme = user?.preferences?.theme;
  return availableThemes.includes(String(requestedTheme || "")) ? String(requestedTheme) : null;
}

function setThemes(themes: Array<string | { id?: string | null }>): string[] {
  const nextThemes = Array.isArray(themes)
    ? themes
      .map((entry) => typeof entry === "string" ? entry : String(entry?.id || ""))
      .filter(Boolean)
    : [];
  availableThemes = nextThemes.length ? [...new Set(nextThemes)] : [...SUPPORTED_THEMES];
  return [...availableThemes];
}

function resolveTheme(): ThemeName {
  const requested = routeQuery.get("theme");
  if (requested) {
    return normalizeTheme(requested, availableThemes);
  }

  try {
    return normalizeTheme(window.localStorage?.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME, availableThemes);
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: string | null | undefined): ThemeName {
  const nextTheme = normalizeTheme(theme, availableThemes);
  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;

  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Keep the resolved theme applied even when storage is unavailable.
  }

  return nextTheme;
}

window.netriskTheme = Object.freeze({
  defaultTheme: DEFAULT_THEME,
  storageKey: THEME_STORAGE_KEY,
  getThemes() {
    return [...availableThemes];
  },
  setThemes(themes: Array<string | { id?: string | null }>) {
    const resolvedThemes = setThemes(themes);
    const currentTheme = applyTheme(document.documentElement.dataset.theme || DEFAULT_THEME);
    return resolvedThemes.includes(currentTheme) ? resolvedThemes : [currentTheme, ...resolvedThemes];
  },
  getCurrentTheme() {
    return normalizeTheme(document.documentElement.dataset.theme || DEFAULT_THEME, availableThemes);
  },
  getThemeFromUser(user?: PublicUser | null) {
    return resolveThemeFromUser(user);
  },
  applyUserTheme(user?: PublicUser | null) {
    const theme = resolveThemeFromUser(user);
    if (!theme) {
      return this.getCurrentTheme();
    }

    return applyTheme(theme);
  },
  applyTheme,
  normalizeTheme(theme: string) {
    return normalizeTheme(theme, availableThemes);
  }
});

window.netriskShell = Object.freeze({
  clearHeaderAuthFeedback() {
    setHeaderAuthFeedback("");
  },
  setHeaderAuthFeedback(message: string, tone: "error" | "success" = "error") {
    setHeaderAuthFeedback(message, tone);
  }
});

function gameHref() {
  return currentGameId ? "/game/" + encodeURIComponent(currentGameId) : "/game.html";
}

function buildLocaleControl({
  container,
  marker,
  wrapperClass,
  labelClass,
  selectClass,
  labelMode = "visible",
  position = "prepend"
}: LocaleControlOptions): void {
  if (!container || container.querySelector(`[${marker}]`)) {
    return;
  }

  const wrapper = document.createElement("label");
  wrapper.className = wrapperClass;
  wrapper.setAttribute(marker, "true");

  const label = document.createElement("span");
  label.className = labelClass;
  label.textContent = t("nav.localeLabel");
  wrapper.appendChild(label);

  const select = document.createElement("select");
  select.className = selectClass;
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

  if (labelMode === "hidden") {
    label.classList.add("visually-hidden");
  }

  if (position === "append") {
    container.append(wrapper);
    return;
  }

  container.prepend(wrapper);
}

function initMarketingShell() {
  buildLocaleControl({
    container: document.querySelector("[data-landing-locale]"),
    marker: "data-shell-locale-switcher",
    wrapperClass: "ld-locale-control",
    labelClass: "ld-locale-label",
    selectClass: "ld-locale-select",
    position: "prepend"
  });

  const menuButton = document.querySelector("[data-landing-menu-toggle]") as HTMLButtonElement | null;
  const menuLabel = document.querySelector("[data-landing-menu-label]") as HTMLElement | null;
  const menuPanel = document.querySelector("[data-landing-mobile-panel]") as HTMLElement | null;
  if (!menuButton || !menuLabel || !menuPanel) {
    return;
  }

  const setMenuState = (expanded: boolean) => {
    menuButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    menuButton.setAttribute("aria-label", t(expanded ? "landing.nav.menuClose" : "landing.nav.menuOpen"));
    menuLabel.textContent = t(expanded ? "landing.nav.menuClose" : "landing.nav.menuOpen");
    menuPanel.hidden = !expanded;
    document.body.dataset.landingMenuOpen = expanded ? "true" : "false";
  };

  setMenuState(false);

  menuButton.addEventListener("click", () => {
    setMenuState(menuButton.getAttribute("aria-expanded") !== "true");
  });

  menuPanel.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (target?.closest("a")) {
      setMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      setMenuState(false);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
    }
  });
}

function sharedNavMarkup() {
  const navAriaLabel = t("nav.aria.primary");
  const navLabels: Record<NavSection, string> = {
    lobby: t("nav.lobby"),
    game: t("nav.game"),
    profile: t("nav.profile")
  };

  return `
    <a href="/lobby.html" class="top-nav-zone top-nav-brand brand-link">
      <p class="eyebrow" data-i18n="app.brand">${t("app.brand")}</p>
      <span class="top-nav-title" data-i18n="app.title">${t("app.title")}</span>
    </a>

    <nav class="top-nav-zone top-nav-links" aria-label="${navAriaLabel}" data-i18n-aria-label="nav.aria.primary">
      <a href="/lobby.html" class="nav-link" data-nav-section="lobby">${navLabels.lobby}</a>
      <a href="${gameHref()}" class="nav-link" data-nav-section="game">${navLabels.game}</a>
      <a href="/profile.html" class="nav-link" data-nav-section="profile">${navLabels.profile}</a>
    </nav>

    <div class="top-nav-zone top-nav-actions">
      <form id="header-login-form" class="top-nav-auth-form" method="post">
        <label class="top-nav-field">
          <span class="visually-hidden" data-i18n="auth.usernameLabel">${t("auth.usernameLabel")}</span>
          <input id="header-auth-username" name="header-username" maxlength="32" placeholder="${t("auth.usernamePlaceholder")}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" data-i18n-placeholder="auth.usernamePlaceholder" />
        </label>
        <label class="top-nav-field">
          <span class="visually-hidden" data-i18n="auth.passwordLabel">${t("auth.passwordLabel")}</span>
          <input id="header-auth-password" name="header-password" type="password" placeholder="${t("auth.passwordPlaceholder")}" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" data-i18n-placeholder="auth.passwordPlaceholder" />
        </label>
        <button type="submit" id="header-login-button" class="ghost-button top-nav-login" data-i18n="auth.login">${t("auth.login")}</button>
        <a href="/register.html" id="header-register-link" class="ghost-button top-nav-register" data-i18n="auth.register">${t("auth.register")}</a>
      </form>
      <p id="top-nav-auth-feedback" class="auth-feedback top-nav-auth-feedback" aria-live="polite" hidden></p>
      <button type="button" id="logout-button" class="ghost-button top-nav-logout" hidden data-i18n="auth.logout">${t("auth.logout")}</button>
      <div class="nav-avatar" id="nav-avatar" aria-label="${t("auth.userProfile")}" data-i18n-aria-label="auth.userProfile">C</div>
    </div>
  `;
}

function sharedFooterMarkup() {
  const navAriaLabel = t("nav.aria.primary");
  const navLabels: Record<NavSection, string> = {
    lobby: t("nav.lobby"),
    game: t("nav.game"),
    profile: t("nav.profile")
  };
  const activeLabel = (section && section in navLabels)
    ? navLabels[section as NavSection]
    : t("app.title");

  return `
    <div class="shared-footer-copy">
      <div>
        <p class="eyebrow" data-i18n="app.brand">${t("app.brand")}</p>
        <h2 class="shared-footer-title" data-i18n="app.title">${t("app.title")}</h2>
      </div>
      <p class="shared-footer-note">${activeLabel}</p>
    </div>
    <nav class="shared-footer-links" aria-label="${navAriaLabel}">
      <a href="/lobby.html" class="nav-link" data-nav-section="lobby">${navLabels.lobby}</a>
      <a href="${gameHref()}" class="nav-link" data-nav-section="game">${navLabels.game}</a>
      <a href="/profile.html" class="nav-link" data-nav-section="profile">${navLabels.profile}</a>
    </nav>
  `;
}

function mountAppChrome() {
  document.querySelectorAll("[data-shared-top-nav]").forEach((container) => {
    const topNavContainer = container as HTMLElement;
    if (!topNavContainer.dataset.sharedChromeMounted) {
      setMarkup(topNavContainer, sharedNavMarkup());
      topNavContainer.dataset.sharedChromeMounted = "true";
    }
  });

  document.querySelectorAll("[data-shared-footer]").forEach((container) => {
    const footerContainer = container as HTMLElement;
    if (!footerContainer.dataset.sharedChromeMounted) {
      setMarkup(footerContainer, sharedFooterMarkup());
      footerContainer.dataset.sharedChromeMounted = "true";
    }
  });
}

function syncAppNav() {
  const navLabels: Record<NavSection, string> = {
    lobby: t("nav.lobby"),
    game: t("nav.game"),
    profile: t("nav.profile")
  };

  document.querySelectorAll("[data-nav-section]").forEach((link) => {
    const navLink = link as HTMLAnchorElement;
    const isActive = navLink.dataset.navSection === section;
    navLink.classList.toggle("is-active", isActive);
    navLink.setAttribute("aria-current", isActive ? "page" : "false");

    const navSection = navLink.dataset.navSection;
    if (navSection && navSection in navLabels) {
      navLink.textContent = navLabels[navSection as NavSection];
    }

    if (navLink.dataset.navSection === "game" && currentGameId) {
      navLink.href = gameHref();
    }
  });

  document.querySelectorAll(".top-nav-links").forEach((nav) => {
    nav.setAttribute("aria-label", t("nav.aria.primary"));
  });
}

async function fallbackHeaderLogin(username: string, password: string): Promise<{ user?: PublicUser }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.loginFailed")));
  }

  return data;
}

function sanitizedCurrentUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("header-username");
  nextUrl.searchParams.delete("header-password");
  return nextUrl;
}

function initAppShell() {
  mountAppChrome();
  applyTranslations(document, activeLocale);
  syncAppNav();

  document.querySelectorAll(".top-nav-actions").forEach((container) => {
    buildLocaleControl({
      container,
      marker: "data-shell-locale-switcher",
      wrapperClass: "top-nav-locale",
      labelClass: "shell-locale-label",
      selectClass: "top-nav-locale-select",
      labelMode: "hidden",
      position: "prepend"
    });
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || form.id !== "header-login-form") {
      return;
    }

    if (form.dataset.headerLoginManaged === "true") {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const usernameInput = form.querySelector("#header-auth-username") as HTMLInputElement | null;
    const passwordInput = form.querySelector("#header-auth-password") as HTMLInputElement | null;
    const username = usernameInput?.value?.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) {
      setHeaderAuthFeedback(t("auth.login.requiredFields"));
      return;
    }

    try {
      setHeaderAuthFeedback("");
      await fallbackHeaderLogin(username, password);
      const nextUrl = sanitizedCurrentUrl();
      if (nextUrl.pathname === "/register.html") {
        window.location.href = "/profile.html";
        return;
      }

      window.location.href = nextUrl.toString();
    } catch (error) {
      setHeaderAuthFeedback(messageFromError(error, t("errors.loginFailed")));
    }
  }, true);
}

document.documentElement.lang = activeLocale;
applyTheme(resolveTheme());
applyTranslations(document, activeLocale);

if ((shellKind as ShellKind) === "app") {
  initAppShell();
} else {
  initMarketingShell();
}
