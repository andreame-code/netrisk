type SpeedInsightsQueue = (...args: unknown[]) => void;

export type SpeedInsightsWindow = Window & {
  si?: SpeedInsightsQueue;
  siq?: unknown[][];
};

export function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isVercelDeploymentHost(hostname: string): boolean {
  return /(?:^|\.)vercel\.app$/i.test(hostname) || /(?:^|\.)vercel\.sh$/i.test(hostname);
}

export function shouldLoadSpeedInsights(hostname: string): boolean {
  return !isLocalDevelopmentHost(hostname) && isVercelDeploymentHost(hostname);
}

export function registerReactShellSpeedInsights(
  targetWindow: SpeedInsightsWindow = window as SpeedInsightsWindow,
  targetDocument: Document = document
): void {
  targetWindow.si =
    targetWindow.si ??
    ((...args: unknown[]) => {
      targetWindow.siq = targetWindow.siq ?? [];
      targetWindow.siq.push(args);
    });

  if (!shouldLoadSpeedInsights(targetWindow.location.hostname)) {
    return;
  }

  if (targetDocument.head.querySelector('script[data-sdkn="@vercel/speed-insights"]')) {
    return;
  }

  const script = targetDocument.createElement("script");
  script.src = "/_vercel/speed-insights/script.js";
  script.defer = true;
  script.dataset.sdkn = "@vercel/speed-insights";
  script.dataset.sdkv = "2.0.0";
  script.onerror = () => {
    console.log("[Vercel Speed Insights] Failed to load script.");
  };

  targetDocument.head.appendChild(script);
}
