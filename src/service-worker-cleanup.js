/* global logger */
// Remove any previously registered service workers to avoid stale caches
// and log their status so that we know if any were present.
export default function cleanupServiceWorkers() {
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (typeof logger !== "undefined") {
          logger.info(`Found ${regs.length} service worker(s)`);
        }
        regs.forEach((reg) => reg.unregister());
      })
      .catch((err) => {
        if (typeof logger !== "undefined") {
          logger.error("Service worker check failed", err);
        }
      });
  }
}
