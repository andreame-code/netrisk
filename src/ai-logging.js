import { REINFORCE, ATTACK } from "./phases.js";
import { addLogEntry, updateInfoPanel } from "./ui.js";
import { updateGameState } from "./state/storage.js";
import { gameState } from "./state/game.js";
import * as logger from "./logger.js";

let lastPlayer;

export default function attachAIActionLogging(game) {
  lastPlayer = game.currentPlayer;

  game.on(REINFORCE, ({ territory, player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} reinforces ${territory}`, {
        player: name,
        type: "reinforce",
        territories: [territory],
      });
      logger.info(`${name} reinforces ${territory}`);
    }
  });

  game.on(ATTACK, ({ from, to }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} attacks ${to} from ${from}`, {
        player: name,
        type: "attack",
        territories: [from, to],
      });
      logger.info(`${name} attacks ${to} from ${from}`);
    }
  });

  game.on("move", ({ from, to, count }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} moves ${count} from ${from} to ${to}`, {
        player: name,
        type: "move",
        territories: [from, to],
      });
      logger.info(`${name} moves ${count} from ${from} to ${to}`);
    }
  });

  game.on("cardsPlayed", ({ player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} plays cards`, {
        player: name,
        type: "cards",
      });
      logger.info(`${name} plays cards`);
    }
  });

  game.on("cardAwarded", ({ player, card }) => {
    const name = game.players[player].name;
    const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
    addLogEntry(`${name} receives a card ${icons[card.type] || card.type}`, {
      player: name,
      type: "card",
    });
    logger.info(`${name} receives card ${card.type}`);
  });

  game.on("turnStart", ({ player }) => {
    const prev = lastPlayer;
    const prevName = game.players[prev].name;
    const nextName = game.players[player].name;
    if (game.players[prev].ai) {
      addLogEntry(`${prevName} ends turn. Next: ${nextName}`, {
        player: prevName,
        type: "endTurn",
      });
      logger.info(`${prevName} ends turn. Next: ${nextName}`);
      gameState.turnNumber += 1;
    }
    lastPlayer = player;
    updateGameState(gameState, game);
    updateInfoPanel();
  });
}
