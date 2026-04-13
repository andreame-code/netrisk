function registerSpeedInsights(targetWindow) {
    targetWindow.si =
        targetWindow.si ??
            ((...args) => {
                targetWindow.siq = targetWindow.siq ?? [];
                targetWindow.siq.push(args);
            });
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
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
registerSpeedInsights(window);
export {};
