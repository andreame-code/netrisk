import {
  registerFrontendObservabilityReporter,
  reportFrontendException,
  type FrontendObservabilityContext
} from "@frontend-core/observability.mts";
import type * as SentryReact from "@sentry/react";

export type ReactShellObservabilityConfig = {
  enabled: boolean;
  dsn: string | null;
  environment: string;
  release: string;
};

type ReactRootErrorInfo = {
  componentStack?: string | null;
};

let initialized = false;
let initializationScheduled = false;
let observabilityGeneration = 0;
type SentryModule = typeof SentryReact;
let sentryPromise: Promise<SentryModule> | null = null;

export type ObservabilityScheduler = (callback: () => void) => void;

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" && error ? error : "Unknown frontend error.");
}

function readEnvironmentBuildConstant(): string | null {
  return typeof __NETRISK_APP_ENVIRONMENT__ !== "undefined"
    ? firstNonEmpty(__NETRISK_APP_ENVIRONMENT__)
    : null;
}

function readReleaseBuildConstant(): string | null {
  return typeof __NETRISK_APP_RELEASE__ !== "undefined"
    ? firstNonEmpty(__NETRISK_APP_RELEASE__)
    : null;
}

export function resolveReactShellObservabilityConfig(
  input: {
    dsn?: string | null;
    environment?: string | null;
    release?: string | null;
  } = {}
): ReactShellObservabilityConfig {
  const environment =
    firstNonEmpty(input.environment, readEnvironmentBuildConstant()) || "development";
  const release = firstNonEmpty(input.release, readReleaseBuildConstant()) || "local-dev";
  const dsn = firstNonEmpty(input.dsn, import.meta.env.VITE_SENTRY_DSN) || null;
  const enabled = Boolean(dsn) && (environment === "preview" || environment === "production");

  return {
    enabled,
    dsn,
    environment,
    release
  };
}

function loadSentry(): Promise<SentryModule> {
  sentryPromise ??= import("@sentry/react");
  return sentryPromise;
}

function applyObservabilityScope(
  Sentry: SentryModule,
  error: Error,
  context: FrontendObservabilityContext = {}
): void {
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("app.area", context.area || "react-shell");
    if (context.kind) {
      scope.setTag("app.error_kind", context.kind);
    }
    if (context.category) {
      scope.setTag("app.error_category", context.category);
    }
    if (context.code) {
      scope.setTag("app.error_code", context.code);
    }
    if (context.path) {
      scope.setTag("app.path", context.path);
    }
    if (context.requestId) {
      scope.setTag("app.request_id", context.requestId);
      scope.setExtra("requestId", context.requestId);
    }
    if (context.statusCode != null) {
      scope.setExtra("statusCode", context.statusCode);
    }
    if (context.componentStack) {
      scope.setContext("react", {
        componentStack: context.componentStack
      });
    }
    if (context.schemaName) {
      scope.setExtra("schemaName", context.schemaName);
    }
    if (context.extra && typeof context.extra === "object") {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

function initializeSentry(config: ReactShellObservabilityConfig): Promise<SentryModule> {
  return loadSentry().then((Sentry) => {
    if (!initialized) {
      Sentry.init({
        dsn: config.dsn || undefined,
        environment: config.environment,
        release: config.release,
        sendDefaultPii: false
      });
      initialized = true;
    }
    return Sentry;
  });
}

function scheduleAfterInitialRender(callback: () => void): void {
  const targetWindow = window as Window & {
    requestIdleCallback?: (idleCallback: () => void, options?: { timeout: number }) => number;
  };

  if (typeof targetWindow.requestIdleCallback === "function") {
    targetWindow.requestIdleCallback(callback, { timeout: 3_000 });
    return;
  }

  window.setTimeout(callback, 1_500);
}

export function initReactShellObservability(
  config: ReactShellObservabilityConfig = resolveReactShellObservabilityConfig(),
  schedule: ObservabilityScheduler = scheduleAfterInitialRender
): ReactShellObservabilityConfig {
  registerFrontendObservabilityReporter((error, context) => {
    if (!config.enabled) {
      return;
    }

    void initializeSentry(config)
      .then((Sentry) => applyObservabilityScope(Sentry, toError(error), context))
      .catch(() => {});
  });

  if (!config.enabled || initialized || initializationScheduled) {
    return config;
  }

  initializationScheduled = true;
  const generation = observabilityGeneration;
  schedule(() => {
    if (generation !== observabilityGeneration) {
      return;
    }
    initializationScheduled = false;
    void initializeSentry(config).catch(() => {});
  });
  return config;
}

function captureReactShellException(
  error: unknown,
  kind: "react_uncaught" | "react_caught" | "react_recoverable",
  errorInfo?: ReactRootErrorInfo
): void {
  reportFrontendException(toError(error), {
    area: "react-shell",
    kind,
    path: typeof window !== "undefined" ? window.location.pathname : "/react/",
    componentStack:
      typeof errorInfo?.componentStack === "string" && errorInfo.componentStack
        ? errorInfo.componentStack
        : undefined
  });
}

export function createReactShellRootOptions(): {
  onUncaughtError(error: unknown, errorInfo: ReactRootErrorInfo): void;
  onCaughtError(error: unknown, errorInfo: ReactRootErrorInfo): void;
  onRecoverableError(error: unknown, errorInfo: ReactRootErrorInfo): void;
} {
  return {
    onUncaughtError(error: unknown, errorInfo: ReactRootErrorInfo): void {
      captureReactShellException(error, "react_uncaught", errorInfo);
    },
    onCaughtError(error: unknown, errorInfo: ReactRootErrorInfo): void {
      captureReactShellException(error, "react_caught", errorInfo);
    },
    onRecoverableError(error: unknown, errorInfo: ReactRootErrorInfo): void {
      captureReactShellException(error, "react_recoverable", errorInfo);
    }
  };
}

export function resetReactShellObservabilityForTests(): void {
  observabilityGeneration += 1;
  initialized = false;
  initializationScheduled = false;
  sentryPromise = null;
  registerFrontendObservabilityReporter(null);
}
