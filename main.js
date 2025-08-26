/* global logger */
import { game, territoryPositions, startNewGame } from "./game-loader.js";
import { init, attachTerritoryHandlers } from "./ui-setup.js";
import { initThemeToggle } from "./theme.js";
import { runAI as runAICore } from "./ai-runner.js";
import { updateUI } from "./ui.js";

// Remove any previously registered service workers to avoid stale caches
// and log their status so that we know if any were present.
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

function runAI() {
  runAICore(game, updateUI);
}

init();
initThemeToggle();

export { game, territoryPositions, runAI, attachTerritoryHandlers, startNewGame };
