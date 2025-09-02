import {
  initGame,
  attachNavigationHandlers,
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
} from './ui-init.js';
import { initThemeToggle } from './theme.js';
import { initTutorialButtons } from './tutorial.js';
attachNavigationHandlers();
initGame().catch(() => {
  const errorEl = document.getElementById('loadError');
  if (errorEl) {
    errorEl.classList.remove('hidden');
    const msg = document.getElementById('loadErrorMsg');
    if (msg) msg.textContent = 'Riprova';
  } else if (typeof alert === 'function') {
    alert('Riprova');
  }
});
initThemeToggle();
initTutorialButtons();

export { game, territoryPositions, runAI, attachTerritoryHandlers, startNewGame };
