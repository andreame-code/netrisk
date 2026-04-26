import {
  isLocalDevelopmentHost,
  isVercelDeploymentHost,
  registerReactShellSpeedInsights,
  shouldLoadSpeedInsights,
  type SpeedInsightsWindow
} from "@react-shell/speed-insights";

import { beforeEach, describe, expect, it } from "vitest";

function createTargetWindow(hostname: string): SpeedInsightsWindow {
  return {
    location: {
      hostname
    }
  } as SpeedInsightsWindow;
}

describe("React shell Speed Insights", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("keeps the deployment host gating behavior", () => {
    expect(isLocalDevelopmentHost("localhost")).toBe(true);
    expect(isLocalDevelopmentHost("127.0.0.1")).toBe(true);
    expect(isVercelDeploymentHost("netrisk.vercel.app")).toBe(true);
    expect(isVercelDeploymentHost("preview.vercel.sh")).toBe(true);
    expect(shouldLoadSpeedInsights("localhost")).toBe(false);
    expect(shouldLoadSpeedInsights("example.com")).toBe(false);
    expect(shouldLoadSpeedInsights("netrisk.vercel.app")).toBe(true);
  });

  it("installs the queue without loading the remote script on local development hosts", () => {
    const targetWindow = createTargetWindow("localhost");

    registerReactShellSpeedInsights(targetWindow, document);
    targetWindow.si?.("event", "pageview");

    expect(targetWindow.siq).toEqual([["event", "pageview"]]);
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("loads the Vercel script once on Vercel deployment hosts", () => {
    const targetWindow = createTargetWindow("netrisk.vercel.app");

    registerReactShellSpeedInsights(targetWindow, document);
    registerReactShellSpeedInsights(targetWindow, document);

    const scripts = document.head.querySelectorAll('script[data-sdkn="@vercel/speed-insights"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("src", "/_vercel/speed-insights/script.js");
    expect(scripts[0]).toHaveAttribute("data-sdkv", "2.0.0");
  });
});
