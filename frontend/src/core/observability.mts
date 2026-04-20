export type FrontendObservabilityContext = {
  area?: string;
  kind?: string;
  category?: string;
  path?: string;
  requestId?: string | null;
  statusCode?: number | null;
  code?: string | null;
  componentStack?: string | null;
  schemaName?: string | null;
  extra?: Record<string, unknown>;
};

export type FrontendObservabilityReporter = (
  error: unknown,
  context?: FrontendObservabilityContext
) => void;

let reporter: FrontendObservabilityReporter | null = null;

export function registerFrontendObservabilityReporter(
  nextReporter: FrontendObservabilityReporter | null
): void {
  reporter = typeof nextReporter === "function" ? nextReporter : null;
}

export function resetFrontendObservabilityReporter(): void {
  reporter = null;
}

export function reportFrontendException(
  error: unknown,
  context: FrontendObservabilityContext = {}
): void {
  if (!reporter) {
    return;
  }

  reporter(error, context);
}
