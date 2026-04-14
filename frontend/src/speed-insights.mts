type SpeedInsightsQueue = (...args: unknown[]) => void;

type SpeedInsightsWindow = Window & {
  si?: SpeedInsightsQueue;
  siq?: unknown[][];
};

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function registerSpeedInsights(targetWindow: SpeedInsightsWindow): void {
  targetWindow.si =
    targetWindow.si ??
    ((...args: unknown[]) => {
      targetWindow.siq = targetWindow.siq ?? [];
      targetWindow.siq.push(args);
    });

  if (isLocalDevelopmentHost(targetWindow.location.hostname)) {
    return;
  }

  const script = document.createElement("script");
  script.src = "/_vercel/speed-insights/script.js";
  script.defer = true;
  script.dataset.sdkn = "@vercel/speed-insights";
  script.dataset.sdkv = "2.0.0";
  script.onerror = () => {
    console.log("[Vercel Speed Insights] Failed to load script. This is expected in local development.");
  };

  document.head.appendChild(script);
}

registerSpeedInsights(window as SpeedInsightsWindow);
