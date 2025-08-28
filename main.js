import cleanupServiceWorkers from "./src/service-worker-cleanup.js";
import {
  initGame,
  attachNavigationHandlers,
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
} from "./src/ui-init.js";
import { initThemeToggle } from "./src/theme.js";
import { initTutorialButtons } from "./src/tutorial.js";

cleanupServiceWorkers();
attachNavigationHandlers();
initGame();
initThemeToggle();
initTutorialButtons();

export { game, territoryPositions, runAI, attachTerritoryHandlers, startNewGame };
