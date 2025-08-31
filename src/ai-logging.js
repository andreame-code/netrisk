import { REINFORCE, ATTACK } from "./phases.js";
import { addLogEntry, updateInfoPanel } from "./ui.js";
// Persist game changes via storage helpers instead of UI exports
import { updateGameState } from "./state/storage.js";
import { gameState } from "./game/state/index.js";
import * as logger from "./logger.js";
import EventBus from "./core/event-bus.js";

let lastPlayer;

function logInfo(message) {
  if (typeof logger?.info === "function") {
    logger.info(message);
  }
}

export default function attachAIActionLogging(game) {
  if (!game) return;

  lastPlayer = game.currentPlayer;

  const bus =
    typeof game.on === "function"
      ? game
      : game.events instanceof EventBus
      ? game.events
      : null;
  if (!bus) return;

  bus.on(REINFORCE, ({ territory, player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} reinforces ${territory}`, {
        player: name,
        type: "reinforce",
        territories: [territory],
      });
      logInfo(`${name} reinforces ${territory}`);
    }
  });

  bus.on(ATTACK, ({ from, to }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} attacks ${to} from ${from}`, {
        player: name,
        type: "attack",
        territories: [from, to],
      });
      logInfo(`${name} attacks ${to} from ${from}`);
    }
  });

  bus.on("move", ({ from, to, count }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} moves ${count} from ${from} to ${to}`, {
        player: name,
        type: "move",
        territories: [from, to],
      });
      logInfo(`${name} moves ${count} from ${from} to ${to}`);
    }
  });

  bus.on("cardsPlayed", ({ player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} plays cards`, {
        player: name,
        type: "cards",
      });
      logInfo(`${name} plays cards`);
    }
  });

  bus.on("cardAwarded", ({ player, card }) => {
    const name = game.players[player].name;
    const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
    addLogEntry(`${name} receives a card ${icons[card.type] || card.type}`, {
      player: name,
      type: "card",
    });
    logInfo(`${name} receives card ${card.type}`);
  });

  bus.on("turnStart", ({ player }) => {
    const prev = lastPlayer;
    const prevName = game.players[prev].name;
    const nextName = game.players[player].name;
    if (game.players[prev].ai) {
      addLogEntry(`${prevName} ends turn. Next: ${nextName}`, {
        player: prevName,
        type: "endTurn",
      });
      logInfo(`${prevName} ends turn. Next: ${nextName}`);
      gameState.incrementTurnNumber();
    }
    lastPlayer = player;
    updateGameState(gameState, game);
    updateInfoPanel();
  });
}
