/* eslint-env browser */
import Game from "../../game.js";

export default function createWebSocketMultiplayer(url) {
  return (game) => {
    const ws = new WebSocket(url);

    const originalEmit = game.emit.bind(game);

    const sync = (event, payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "state",
            state: game.serialize(),
            event,
            payload,
          }),
        );
      }
    };

    game.emit = (event, payload) => {
      const result = originalEmit(event, payload);
      if (event !== "stateUpdated") {
        sync(event, payload);
      }
      return result;
    };

    ws.addEventListener("open", () => sync());
    ws.addEventListener("message", (event) => {
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
        if (msg.event && msg.event !== "stateUpdated") {
          originalEmit(msg.event, msg.payload);
        }
        originalEmit("stateUpdated", { player: game.currentPlayer });
      }
    });
  };
}
