import { GAME_OVER } from "./phases.js";

export function runAI(game, updateUI) {
  if (
    game.players[game.currentPlayer].ai &&
    game.getPhase() !== GAME_OVER
  ) {
    setTimeout(() => {
      game.performAITurn();
      updateUI();
      runAI(game, updateUI);
    }, 0);
  }
}
