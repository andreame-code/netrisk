import { setMarkup } from "./core/dom.mjs";
import { DEFAULT_THEME, SUPPORTED_THEMES, normalizeTheme } from "./core/contracts.mjs";
import { messageFromError } from "./core/errors.mjs";
import { applyTranslations, listSupportedLocales, resolveLocale, setLocale, t, translateServerMessage } from "./i18n.mjs";
const THEME_STORAGE_KEY = "netrisk.theme";
const routeQuery = new URLSearchParams(window.location.search);
const shellKind = document.body.dataset.shellKind || (document.body.dataset.appSection ? "app" : "marketing");
const section = document.body.dataset.appSection || "";
const pathGameMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
const currentGameId = pathGameMatch ? decodeURIComponent(pathGameMatch[1]) : routeQuery.get("gameId");
const activeLocale = setLocale(resolveLocale());
function resolveThemeFromUser(user) {
    const requestedTheme = user?.preferences?.theme;
    return SUPPORTED_THEMES.includes(requestedTheme) ? requestedTheme : null;
}
function resolveTheme() {
    const requested = routeQuery.get("theme");
    if (requested) {
        return normalizeTheme(requested);
    }
    try {
        return normalizeTheme(window.localStorage?.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME);
    }
    catch {
        return DEFAULT_THEME;
    }
}
function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = nextTheme;
    document.body.dataset.theme = nextTheme;
    try {
        window.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    catch {
        // Keep the resolved theme applied even when storage is unavailable.
    }
    return nextTheme;
}
window.netriskTheme = Object.freeze({
    defaultTheme: DEFAULT_THEME,
    storageKey: THEME_STORAGE_KEY,
    getThemes() {
        return [...SUPPORTED_THEMES];
    },
    getCurrentTheme() {
        return normalizeTheme(document.documentElement.dataset.theme || DEFAULT_THEME);
    },
    getThemeFromUser(user) {
        return resolveThemeFromUser(user);
    },
    applyUserTheme(user) {
        const theme = resolveThemeFromUser(user);
        if (!theme) {
            return this.getCurrentTheme();
        }
        return applyTheme(theme);
    },
    applyTheme,
    normalizeTheme
});
function gameHref() {
    return currentGameId ? "/game/" + encodeURIComponent(currentGameId) : "/game.html";
}
function buildLocaleControl({ container, marker, wrapperClass, labelClass, selectClass, labelMode = "visible", position = "prepend" }) {
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
}
function sharedNavMarkup() {
    const navAriaLabel = t("nav.aria.primary");
    const navLabels = {
        lobby: t("nav.lobby"),
        game: t("nav.game"),
        profile: t("nav.profile")
    };
    return `
    <a href="/lobby.html" class="top-nav-zone top-nav-brand brand-link">
      <p class="eyebrow" data-i18n="app.brand">${t("app.brand")}</p>
      <h1 data-i18n="app.title">${t("app.title")}</h1>
    </a>

    <nav class="top-nav-zone top-nav-links" aria-label="${navAriaLabel}" data-i18n-aria-label="nav.aria.primary">
      <a href="/lobby.html" class="nav-link" data-nav-section="lobby">${navLabels.lobby}</a>
      <a href="${gameHref()}" class="nav-link" data-nav-section="game">${navLabels.game}</a>
      <a href="/profile.html" class="nav-link" data-nav-section="profile">${navLabels.profile}</a>
    </nav>

    <div class="top-nav-zone top-nav-actions">
      <form id="header-login-form" class="top-nav-auth-form" method="post">
        <input id="header-auth-username" name="header-username" maxlength="32" placeholder="${t("auth.usernamePlaceholder")}" autocomplete="username" data-i18n-placeholder="auth.usernamePlaceholder" />
        <input id="header-auth-password" name="header-password" type="password" placeholder="${t("auth.passwordPlaceholder")}" autocomplete="current-password" data-i18n-placeholder="auth.passwordPlaceholder" />
        <button type="submit" id="header-login-button" class="ghost-button top-nav-login" data-i18n="auth.login">${t("auth.login")}</button>
        <a href="/register.html" id="header-register-link" class="ghost-button top-nav-register" data-i18n="auth.register">${t("auth.register")}</a>
      </form>
      <button type="button" id="logout-button" class="ghost-button top-nav-logout" hidden data-i18n="auth.logout">${t("auth.logout")}</button>
      <div class="nav-avatar" id="nav-avatar" aria-label="${t("auth.userProfile")}" data-i18n-aria-label="auth.userProfile">C</div>
    </div>
  `;
}
function sharedFooterMarkup() {
    const navAriaLabel = t("nav.aria.primary");
    const navLabels = {
        lobby: t("nav.lobby"),
        game: t("nav.game"),
        profile: t("nav.profile")
    };
    const activeLabel = (section && section in navLabels)
        ? navLabels[section]
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
        const topNavContainer = container;
        if (!topNavContainer.dataset.sharedChromeMounted) {
            setMarkup(topNavContainer, sharedNavMarkup());
            topNavContainer.dataset.sharedChromeMounted = "true";
        }
    });
    document.querySelectorAll("[data-shared-footer]").forEach((container) => {
        const footerContainer = container;
        if (!footerContainer.dataset.sharedChromeMounted) {
            setMarkup(footerContainer, sharedFooterMarkup());
            footerContainer.dataset.sharedChromeMounted = "true";
        }
    });
}
function syncAppNav() {
    const navLabels = {
        lobby: t("nav.lobby"),
        game: t("nav.game"),
        profile: t("nav.profile")
    };
    document.querySelectorAll("[data-nav-section]").forEach((link) => {
        const navLink = link;
        const isActive = navLink.dataset.navSection === section;
        navLink.classList.toggle("is-active", isActive);
        navLink.setAttribute("aria-current", isActive ? "page" : "false");
        const navSection = navLink.dataset.navSection;
        if (navSection && navSection in navLabels) {
            navLink.textContent = navLabels[navSection];
        }
        if (navLink.dataset.navSection === "game" && currentGameId) {
            navLink.href = gameHref();
        }
    });
    document.querySelectorAll(".top-nav-links").forEach((nav) => {
        nav.setAttribute("aria-label", t("nav.aria.primary"));
    });
}
async function fallbackHeaderLogin(username, password) {
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
        const usernameInput = form.querySelector("#header-auth-username");
        const passwordInput = form.querySelector("#header-auth-password");
        const username = usernameInput?.value?.trim() || "";
        const password = passwordInput?.value || "";
        if (!username || !password) {
            return;
        }
        try {
            await fallbackHeaderLogin(username, password);
            const nextUrl = sanitizedCurrentUrl();
            if (nextUrl.pathname === "/register.html") {
                window.location.href = "/profile.html";
                return;
            }
            window.location.href = nextUrl.toString();
        }
        catch (error) {
            window.alert(messageFromError(error, t("errors.loginFailed")));
        }
    }, true);
}
document.documentElement.lang = activeLocale;
applyTheme(resolveTheme());
applyTranslations(document, activeLocale);
if (shellKind === "app") {
    initAppShell();
}
else {
    initMarketingShell();
}
