import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import type {
  ModuleOptionsResponse,
  NetRiskUiSlotContribution
} from "@frontend-generated/shared-runtime-validation.mts";

import { getModuleOptions } from "@frontend-core/api/client.mts";
import { resolvedUiSlots } from "@frontend-core/module-catalog.mts";
import { getLocale, listSupportedLocales, setLocale, t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { clearCurrentPlayerId } from "@react-shell/player-session";
import {
  buildAdminPath,
  buildBootstrapPath,
  buildGameIndexPath,
  buildGamePath,
  buildLobbyPath,
  buildProfilePath,
  buildRegisterPath,
  useShellNamespace
} from "@react-shell/public-auth-paths";

type AppSection = "admin" | "game" | "lobby" | "login" | "profile" | "register";

function resolveAppSection(pathname: string): AppSection {
  if (pathname === "/login" || pathname === "/react/login") {
    return "login";
  }

  if (pathname === "/register" || pathname === "/register.html" || pathname === "/react/register") {
    return "register";
  }

  if (pathname === "/profile" || pathname === "/profile.html" || pathname === "/react/profile") {
    return "profile";
  }

  if (
    pathname === "/admin" ||
    pathname === "/react/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/react/admin/")
  ) {
    return "admin";
  }

  if (
    pathname === "/game" ||
    pathname === "/game.html" ||
    pathname === "/react/game" ||
    /^\/game\/[^/]+$/.test(pathname) ||
    /^\/react\/game\/[^/]+$/.test(pathname)
  ) {
    return "game";
  }

  return "lobby";
}

export function resolveCurrentGameId(pathname: string, search: string): string | null {
  const pathMatch = pathname.match(/^\/(?:react\/)?game\/([^/?#]+)$/);
  if (pathMatch) {
    const rawGameId = pathMatch[1] || "";

    try {
      return decodeURIComponent(rawGameId);
    } catch {
      return rawGameId;
    }
  }

  const searchParams = new URLSearchParams(search);
  const queryValue = searchParams.get("gameId");
  return queryValue ? queryValue : null;
}

function sanitizedCurrentLocation(): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("header-username");
  nextUrl.searchParams.delete("header-password");
  return nextUrl.toString();
}

function sessionStatusLabel(status: ReturnType<typeof useAuth>["state"]["status"]): string {
  if (status === "authenticated") {
    return "authenticated";
  }

  if (status === "loading") {
    return "loading";
  }

  if (status === "error") {
    return "error";
  }

  return "guest";
}

function isNavSectionActive(
  section: AppSection,
  target: "admin" | "game" | "lobby" | "profile"
): boolean {
  if (target === "lobby") {
    return section === "lobby" || section === "login" || section === "register";
  }

  return section === target;
}

function emptyModuleOptions(): ModuleOptionsResponse {
  return {
    modules: [],
    enabledModules: [],
    gameModules: [],
    content: {},
    gamePresets: [],
    uiSlots: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: []
  };
}

export function LegacyAppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const namespace = useShellNamespace();
  const { state, signIn, signOut } = useAuth();
  const section = resolveAppSection(location.pathname);
  const currentGameId = resolveCurrentGameId(location.pathname, location.search);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const moduleOptionsQuery = useQuery({
    queryKey: ["shell", "module-options"],
    retry: false,
    queryFn: async () => {
      try {
        return (
          (await getModuleOptions({
            errorMessage: t("errors.requestFailed"),
            fallbackMessage: t("errors.requestFailed")
          })) || emptyModuleOptions()
        );
      } catch {
        return emptyModuleOptions();
      }
    }
  });

  useEffect(() => {
    document.body.dataset.shellKind = "app";
    document.body.dataset.appSection = section;
  }, [section]);

  const isAuthenticated = state.status === "authenticated";
  const lobbyHref = buildLobbyPath(namespace);
  const adminHref = buildAdminPath(namespace);
  const profileHref = buildProfilePath(namespace);
  const registerHref = buildRegisterPath(namespace);
  const bootstrapHref = buildBootstrapPath(namespace);
  const gameHref = currentGameId
    ? buildGamePath(currentGameId, namespace)
    : buildGameIndexPath(namespace);
  const avatarLabel = isAuthenticated ? state.user.username : "C";
  const avatar = avatarLabel.trim().charAt(0).toUpperCase() || "C";
  const topNavSlots = (resolvedUiSlots(moduleOptionsQuery.data) as NetRiskUiSlotContribution[])
    .filter((slot) => slot.slotId === "top-nav-bar")
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const visibleTopNavSlots = isAuthenticated ? topNavSlots : [];
  const currentLocale = getLocale();

  async function handleHeaderLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setLoginError(t("auth.login.requiredFields"));
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError("");

    try {
      await signIn({
        username: trimmedUsername,
        password
      });
      setUsername("");
      setPassword("");
      window.location.assign(sanitizedCurrentLocation());
    } catch (error) {
      const fallbackMessage =
        currentLocale === "it"
          ? t("auth.login.invalidCredentials")
          : "Unable to sign in with those credentials.";
      setLoginError(error instanceof Error && error.message ? error.message : fallbackMessage);
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setLoginError("");
    clearCurrentPlayerId();
    await signOut();
  }

  function handleLocaleChange(nextLocale: string): void {
    const resolvedLocale = setLocale(nextLocale);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("lang", resolvedLocale);
    window.location.assign(nextUrl.toString());
  }

  const frameClassName =
    section === "game" ? "app-frame game-app-frame" : "app-frame top-nav-page-frame";
  const mainClassName =
    section === "game"
      ? "page-shell game-page-shell campaign-page-shell"
      : "page-shell top-nav-page-shell campaign-page-shell";
  const footerClassName =
    section === "game"
      ? "panel shared-bottom-shell game-bottom-shell"
      : "panel shared-bottom-shell";
  const content = (
    <div className="shell-header" style={{ display: "contents" }}>
      <header className="panel top-nav-bar campaign-nav">
        <Link className="top-nav-zone top-nav-brand brand-link" to={lobbyHref}>
          <p className="eyebrow">{t("app.brand")}</p>
          <span className="top-nav-title">{t("app.title")}</span>
        </Link>

        <nav
          className="top-nav-zone top-nav-links"
          aria-label={t("nav.aria.primary")}
          data-testid="react-shell-nav"
        >
          <Link
            className={`nav-link${isNavSectionActive(section, "lobby") ? " is-active" : ""}`}
            to={lobbyHref}
          >
            {t("nav.lobby")}
          </Link>
          <Link
            className={`nav-link${isNavSectionActive(section, "game") ? " is-active" : ""}`}
            to={gameHref}
          >
            {t("nav.game")}
          </Link>
          <Link
            className={`nav-link${isNavSectionActive(section, "profile") ? " is-active" : ""}`}
            to={profileHref}
          >
            {t("nav.profile")}
          </Link>
          {isAuthenticated && state.user.role === "admin" ? (
            <Link
              className={`nav-link${isNavSectionActive(section, "admin") ? " is-active" : ""}`}
              to={adminHref}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="top-nav-zone top-nav-module-slots" id="top-nav-module-slots">
          {visibleTopNavSlots.map((slot, index) =>
            slot.route ? (
              <a
                key={`${slot.slotId}:${slot.route || slot.title}:${slot.order || index}`}
                href={slot.route}
                className="badge"
              >
                {slot.title}
              </a>
            ) : (
              <span key={`${slot.slotId}:${slot.title}:${slot.order || index}`} className="badge">
                {slot.title}
              </span>
            )
          )}
        </div>

        <div className="top-nav-zone top-nav-actions">
          <label className="top-nav-locale">
            <span className="shell-locale-label visually-hidden">{t("nav.localeLabel")}</span>
            <select
              className="top-nav-locale-select"
              aria-label={t("nav.localeLabel")}
              value={currentLocale}
              onChange={(event) => handleLocaleChange(event.target.value)}
            >
              {listSupportedLocales().map((locale) => (
                <option key={locale} value={locale}>
                  {t(`locale.label.${locale}`, {}, { fallback: locale.toUpperCase() })}
                </option>
              ))}
            </select>
          </label>
          <form
            id="header-login-form"
            className="top-nav-auth-form"
            method="post"
            hidden={isAuthenticated}
            onSubmit={(event) => void handleHeaderLogin(event)}
          >
            <label className="top-nav-field">
              <span className="visually-hidden">{t("auth.usernameLabel")}</span>
              <input
                id="header-auth-username"
                name="header-username"
                maxLength={32}
                placeholder={t("auth.usernamePlaceholder")}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmittingLogin}
              />
            </label>
            <label className="top-nav-field">
              <span className="visually-hidden">{t("auth.passwordLabel")}</span>
              <input
                id="header-auth-password"
                name="header-password"
                type="password"
                placeholder={t("auth.passwordPlaceholder")}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmittingLogin}
              />
            </label>
            <button
              type="submit"
              id="header-login-button"
              className="ghost-button top-nav-login"
              disabled={isSubmittingLogin}
            >
              {isSubmittingLogin ? "..." : t("auth.login")}
            </button>
            <Link
              to={registerHref}
              id="header-register-link"
              className="ghost-button top-nav-register"
            >
              {t("auth.register")}
            </Link>
          </form>
          <p
            id="top-nav-auth-feedback"
            className={`auth-feedback top-nav-auth-feedback${loginError ? " is-error" : ""}`}
            aria-live="polite"
            hidden={!loginError}
          >
            {loginError}
          </p>
          <span className="visually-hidden" data-testid="react-shell-session-status">
            {sessionStatusLabel(state.status)}
          </span>
          <button
            type="button"
            id="logout-button"
            className="ghost-button top-nav-logout"
            hidden={!isAuthenticated}
            onClick={() => void handleLogout()}
          >
            {t("auth.logout")}
          </button>
          <div className="nav-avatar" id="nav-avatar" aria-label={t("auth.userProfile")}>
            {avatar}
          </div>
        </div>
      </header>

      {children}
    </div>
  );

  return (
    <div data-testid="react-shell-layout">
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <div className="backdrop" />
      <div className={frameClassName}>
        <main id="main-content" className={mainClassName}>
          {section === "game" ? (
            <section className="app-shell board-shell" data-testid="app-shell">
              {content}
            </section>
          ) : (
            content
          )}
        </main>

        <footer className={footerClassName}>
          <div className="shared-footer-copy">
            <div>
              <p className="eyebrow">{t("app.brand")}</p>
              <h2 className="shared-footer-title">{t("app.title")}</h2>
            </div>
            <p className="shared-footer-note">
              {section === "profile"
                ? t("nav.profile")
                : section === "game"
                  ? t("nav.game")
                  : t("nav.lobby")}
            </p>
          </div>
          <nav className="shared-footer-links" aria-label={t("nav.aria.primary")}>
            <Link className="nav-link" to={lobbyHref}>
              {t("nav.lobby")}
            </Link>
            <Link className="nav-link" to={gameHref}>
              {t("nav.game")}
            </Link>
            <Link className="nav-link" to={profileHref}>
              {t("nav.profile")}
            </Link>
          </nav>
          {section === "login" ? (
            <div className="shared-footer-links">
              <Link className="nav-link" to={bootstrapHref}>
                {t("app.title")}
              </Link>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
