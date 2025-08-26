/* global logger */
import { REINFORCE, ATTACK } from "./phases.js";
import { addLogEntry, updateInfoPanel } from "./ui.js";
import { updateGameState } from "./persistence.js";

export function attachAIActionLogging(game, gameState) {
  let lastPlayer = game.currentPlayer;

  game.on(REINFORCE, ({ territory, player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} reinforces ${territory}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} reinforces ${territory}`);
      }
    }
  });

  game.on(ATTACK, ({ from, to }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} attacks ${to} from ${from}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} attacks ${to} from ${from}`);
      }
    }
  });

  game.on("move", ({ from, to, count }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} moves ${count} from ${from} to ${to}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} moves ${count} from ${from} to ${to}`);
      }
    }
  });

  game.on("cardsPlayed", ({ player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} plays cards`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} plays cards`);
      }
    }
  });

  game.on("cardAwarded", ({ player, card }) => {
    const name = game.players[player].name;
    const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
    addLogEntry(`${name} receives a card ${icons[card.type] || card.type}`);
    if (typeof logger !== "undefined") {
      logger.info(`${name} receives card ${card.type}`);
    }
  });

  game.on("turnStart", ({ player }) => {
    const prev = lastPlayer;
    const prevName = game.players[prev].name;
    const nextName = game.players[player].name;
    if (game.players[prev].ai) {
      addLogEntry(`${prevName} ends turn. Next: ${nextName}`);
      if (typeof logger !== "undefined") {
        logger.info(`${prevName} ends turn. Next: ${nextName}`);
      }
      gameState.turnNumber += 1;
    }
    lastPlayer = player;
    updateGameState(gameState, game);
    updateInfoPanel();
  });
}
