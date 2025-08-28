import cleanupServiceWorkers from "./service-worker-cleanup.js";
import {
  initGame,
  attachNavigationHandlers,
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
} from "./ui-init.js";
import { initThemeToggle } from "./theme.js";
import { initTutorialButtons } from "./tutorial.js";

cleanupServiceWorkers();
attachNavigationHandlers();
initGame();
initThemeToggle();
initTutorialButtons();

export { game, territoryPositions, runAI, attachTerritoryHandlers, startNewGame };
