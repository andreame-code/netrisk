import { screen, waitFor, within } from "@testing-library/react";

import type { ModuleOptionsResponse } from "@frontend-generated/shared-runtime-validation.mts";

import { getModuleOptions, getSession, login } from "@frontend-core/api/client.mts";

import { renderReactShell } from "../../test/render-react-shell";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getSession: vi.fn(),
  getModuleOptions: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  updateThemePreference: vi.fn(),
  listGames: vi.fn(),
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn()
}));

const getSessionMock = vi.mocked(getSession);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const loginMock = vi.mocked(login);

const localeExpectations = [
  {
    locale: "it",
    loginTitle: "Frontline Dominion - Accedi",
    loginEyebrow: "Accesso",
    loginHeading: "Accedi al comando",
    registerTitle: "Frontline Dominion - Registrazione",
    registerEyebrow: "Creazione account",
    navGame: "Partita",
    navProfile: "Profilo"
  },
  {
    locale: "en",
    loginTitle: "Frontline Dominion - Log in",
    loginEyebrow: "Login",
    loginHeading: "Log in to command",
    registerTitle: "Frontline Dominion - Registration",
    registerEyebrow: "Account Setup",
    navGame: "Game",
    navProfile: "Profile"
  },
  {
    locale: "de",
    loginTitle: "Frontline Dominion - Anmelden",
    loginEyebrow: "Anmeldung",
    loginHeading: "Bei der Kommandozentrale anmelden",
    registerTitle: "Frontline Dominion - Registrierung",
    registerEyebrow: "Kontoeinrichtung",
    navGame: "Spiel",
    navProfile: "Profil"
  },
  {
    locale: "es",
    loginTitle: "Frontline Dominion - Iniciar sesión",
    loginEyebrow: "Acceso",
    loginHeading: "Inicia sesión en el centro de mando",
    registerTitle: "Frontline Dominion - Registro",
    registerEyebrow: "Configuración de cuenta",
    navGame: "Juego",
    navProfile: "Perfil"
  }
] as const;

const namespaces = [
  { label: "canonical", prefix: "" },
  { label: "React alias", prefix: "/react" }
] as const;

function createAuthRequiredError(): Error & { code: string } {
  const error = new Error("Sign in to continue.") as Error & { code: string };
  error.code = "AUTH_REQUIRED";
  return error;
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

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  document.title = "NetRisk";
  getSessionMock.mockRejectedValue(createAuthRequiredError());
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
});

describe.each(namespaces)("$label public authentication routes", ({ prefix }) => {
  it("clears a failed quick-login error before showing the dedicated login page", async () => {
    loginMock.mockRejectedValue(new Error("Invalid header credentials"));
    const { user } = renderReactShell(`${prefix}/register`, "it");

    const registerPage = await screen.findByTestId("react-shell-register-page");
    const headerUsername = document.querySelector<HTMLInputElement>("#header-auth-username");
    const headerPassword = document.querySelector<HTMLInputElement>("#header-auth-password");
    const headerSubmit = document.querySelector<HTMLButtonElement>("#header-login-button");
    const headerFeedback = document.querySelector<HTMLParagraphElement>("#top-nav-auth-feedback");

    expect(headerUsername).not.toBeNull();
    expect(headerPassword).not.toBeNull();
    expect(headerSubmit).not.toBeNull();
    expect(headerFeedback).not.toBeNull();

    await user.type(headerUsername!, "bad-user");
    await user.type(headerPassword!, "bad-password");
    await user.click(headerSubmit!);

    await waitFor(() => {
      expect(headerFeedback).toHaveTextContent("Invalid header credentials");
    });

    await user.click(within(registerPage).getByRole("link", { name: "Accedi" }));
    expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();

    await waitFor(() => {
      expect(headerFeedback).toHaveTextContent("");
      expect(headerFeedback).not.toBeVisible();
    });
  });

  it("accepts the login route with a trailing slash", async () => {
    renderReactShell(`${prefix}/login/`, "it");

    expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();
  });

  it.each(localeExpectations)(
    "localizes login metadata, content, and navigation in $locale",
    async ({ locale, loginTitle, loginEyebrow, loginHeading, navGame, navProfile }) => {
      renderReactShell(`${prefix}/login`, locale);

      const page = await screen.findByTestId("react-shell-login-page");
      const route = within(page);

      await waitFor(() => {
        expect(document.title).toBe(loginTitle);
      });
      expect(route.getByText(loginEyebrow)).toBeInTheDocument();
      expect(route.getByRole("heading", { name: loginHeading })).toBeInTheDocument();

      const primaryNavigation = within(screen.getByTestId("react-shell-nav"));
      const footerNavigation = within(screen.getByRole("contentinfo"));
      expect(primaryNavigation.getByRole("link", { name: navGame })).toBeInTheDocument();
      expect(primaryNavigation.getByRole("link", { name: navProfile })).toBeInTheDocument();
      expect(footerNavigation.getByRole("link", { name: navGame })).toBeInTheDocument();
      expect(footerNavigation.getByRole("link", { name: navProfile })).toBeInTheDocument();
    }
  );

  it.each(localeExpectations)(
    "localizes registration metadata and removes internal copy in $locale",
    async ({ locale, registerTitle, registerEyebrow }) => {
      renderReactShell(`${prefix}/register`, locale);

      const page = await screen.findByTestId("react-shell-register-page");

      await waitFor(() => {
        expect(document.title).toBe(registerTitle);
      });
      expect(within(page).getByText(registerEyebrow)).toBeInTheDocument();
      expect(within(page).queryByText("Public route")).not.toBeInTheDocument();
    }
  );
});
