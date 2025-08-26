/* eslint-env browser */
import Game from "../../game.js";
import { REINFORCE, ATTACK, FORTIFY } from "../../phases.js";

export default function createWebSocketMultiplayer(url) {
  return game => {
    const ws = new WebSocket(url);

    const sync = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "state", state: game.serialize() })
        );
      }
    };

    ws.addEventListener("open", sync);
    ws.addEventListener("message", event => {
      const msg = JSON.parse(event.data);
      if (msg.type === "state") {
        const preserved = game.events;
        const updated = Game.deserialize(msg.state);
        Object.assign(game, {
          players: updated.players,
          territories: updated.territories,
          continents: updated.continents,
          deck: updated.deck,
          hands: updated.hands,
          discard: updated.discard,
          currentPlayer: updated.currentPlayer,
          phase: updated.phase,
          reinforcements: updated.reinforcements,
          selectedFrom: updated.selectedFrom,
          conqueredThisTurn: updated.conqueredThisTurn,
          winner: updated.winner,
        });
        game.events = preserved;
        game.emit("stateUpdated", { player: game.currentPlayer });
      }
    });

    game.on("phaseChange", sync);
    game.on(REINFORCE, sync);
    game.on(ATTACK, sync);
    game.on(FORTIFY, sync);
  };
}
