import "./instrument";

import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";

import { resolveLocale, setLocale } from "@frontend-i18n";

import { createReactShellRootOptions } from "@react-shell/observability";
import { applyStoredRegisteredShellTheme, installShellThemeBridge } from "@react-shell/theme";

const LandingApp = lazy(async () => ({
  default: (await import("@react-shell/landing-app")).LandingApp
}));
const ShellApp = lazy(async () => ({
  default: (await import("@react-shell/App")).App
}));

setLocale(resolveLocale());
installShellThemeBridge();
applyStoredRegisteredShellTheme();

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("React shell root element not found.");
}

const InitialApp = window.location.pathname === "/" ? LandingApp : ShellApp;

ReactDOM.createRoot(rootElement, createReactShellRootOptions()).render(
  <Suspense
    fallback={
      <section className="status-panel status-panel-loading" data-testid="react-shell-loading">
        <p className="status-label">Loading</p>
        <h2>Loading NetRisk</h2>
        <p className="status-copy">Preparing the requested route.</p>
      </section>
    }
  >
    <InitialApp />
  </Suspense>
);
