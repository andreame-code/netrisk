import { render, screen } from "@testing-library/react";

import {
  registerFrontendObservabilityReporter,
  reportFrontendException
} from "@frontend-core/observability.mts";
import {
  createReactShellRootOptions,
  initReactShellObservability,
  resetReactShellObservabilityForTests,
  resolveReactShellObservabilityConfig
} from "@react-shell/observability";
import { ShellErrorBoundary } from "@react-shell/shell-error-boundary";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => {
  const scope = {
    setContext: vi.fn(),
    setExtra: vi.fn(),
    setLevel: vi.fn(),
    setTag: vi.fn()
  };

  return {
    captureException: vi.fn(),
    init: vi.fn(),
    scope,
    withScope: vi.fn((callback: (value: typeof scope) => void) => callback(scope))
  };
});

vi.mock("@sentry/react", () => ({
  captureException: sentryMocks.captureException,
  init: sentryMocks.init,
  withScope: sentryMocks.withScope
}));

describe("react shell observability", () => {
  beforeEach(() => {
    resetReactShellObservabilityForTests();
    sentryMocks.captureException.mockReset();
    sentryMocks.init.mockReset();
    sentryMocks.scope.setContext.mockReset();
    sentryMocks.scope.setExtra.mockReset();
    sentryMocks.scope.setLevel.mockReset();
    sentryMocks.scope.setTag.mockReset();
    sentryMocks.withScope.mockClear();
  });

  afterEach(() => {
    resetReactShellObservabilityForTests();
  });

  it("keeps observability disabled without a DSN or deploy environment", () => {
    expect(
      resolveReactShellObservabilityConfig({
        dsn: null,
        environment: "development",
        release: "rel-dev"
      })
    ).toEqual({
      enabled: false,
      dsn: null,
      environment: "development",
      release: "rel-dev"
    });
  });

  it("reads Vite build constants when runtime overrides are omitted", () => {
    expect(
      resolveReactShellObservabilityConfig({
        dsn: "https://public@example.ingest.sentry.io/123"
      })
    ).toEqual({
      enabled: true,
      dsn: "https://public@example.ingest.sentry.io/123",
      environment: "preview",
      release: "vitest-build"
    });
  });

  it("initializes Sentry only for preview and production when the DSN is configured", () => {
    const config = resolveReactShellObservabilityConfig({
      dsn: "https://public@example.ingest.sentry.io/123",
      environment: "preview",
      release: "sha-preview"
    });

    const resolved = initReactShellObservability(config);

    expect(resolved.enabled).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.ingest.sentry.io/123",
        environment: "preview",
        release: "sha-preview",
        sendDefaultPii: false
      })
    );
  });

  it("forwards registered frontend errors to Sentry with request correlation context", () => {
    initReactShellObservability({
      enabled: true,
      dsn: "https://public@example.ingest.sentry.io/123",
      environment: "production",
      release: "sha-prod"
    });

    const error = new Error("Unexpected HTTP failure.");
    reportFrontendException(error, {
      area: "react-shell",
      kind: "http",
      path: "/api/profile",
      requestId: "req-42",
      statusCode: 500,
      code: "SERVER_FAILURE",
      schemaName: "ProfileResponse"
    });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(sentryMocks.scope.setTag).toHaveBeenCalledWith("app.request_id", "req-42");
    expect(sentryMocks.scope.setExtra).toHaveBeenCalledWith("statusCode", 500);
    expect(sentryMocks.scope.setExtra).toHaveBeenCalledWith("schemaName", "ProfileResponse");
  });

  it("reports React root errors through the shared frontend reporter", () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    createReactShellRootOptions().onUncaughtError(new Error("Root crash."), {
      componentStack: "\n in BrokenRoute"
    });

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Root crash."
      }),
      expect.objectContaining({
        area: "react-shell",
        kind: "react_uncaught",
        componentStack: "\n in BrokenRoute"
      })
    );
  });

  it("renders a fallback panel when the shell crashes during render", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BrokenRoute() {
      throw new Error("Render failure.");
      return null;
    }

    render(
      <ShellErrorBoundary>
        <BrokenRoute />
      </ShellErrorBoundary>
    );

    expect(screen.getByTestId("react-shell-crash-fallback")).toBeInTheDocument();
    expect(screen.getByText("React shell unavailable")).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
