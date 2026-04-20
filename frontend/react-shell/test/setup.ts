import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";

import { DEFAULT_LOCALE, setLocale } from "@frontend-i18n";
import { resetFrontendObservabilityReporter } from "@frontend-core/observability.mts";

import { resetAuthState } from "@react-shell/auth-store";

import { afterEach, beforeEach, vi } from "vitest";

configure({
  asyncUtilTimeout: 10_000
});

function resetBrowserState(): void {
  window.localStorage.clear();
  resetAuthState();
  resetFrontendObservabilityReporter();

  document.documentElement.removeAttribute("data-theme");
  document.body?.removeAttribute("data-theme");

  setLocale(DEFAULT_LOCALE, {
    storage: window.localStorage,
    applyDocument: true
  });

  window.history.replaceState({}, "", "/react/");
}

beforeEach(() => {
  resetBrowserState();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetBrowserState();
});
