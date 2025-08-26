import { attackSuccessProbability, territoryPriority } from "../../ai.js";
import { REINFORCE, ATTACK, FORTIFY, GAME_OVER } from "../../phases.js";

export function performAITurn(game) {
  if (!game.players[game.currentPlayer].ai || game.phase === GAME_OVER) return;
  // Play cards if possible
  const hand = game.hands[game.currentPlayer];
  const set = game.findValidSet(hand);
  if (set) game.playCards(set);

  // Reinforce prioritizing territories
  while (game.reinforcements > 0) {
    const owned = game.territories.filter(t => t.owner === game.currentPlayer);
    if (owned.length === 0) break;
    const target = owned.reduce((best, t) => {
      const score = territoryPriority(game, t);
      return !best || score > best.score ? { t, score } : best;
    }, null).t;
    target.armies += 1;
    game.reinforcements -= 1;
    game.emit(REINFORCE, { territory: target.id, player: game.currentPlayer });
  }
  if (game.phase === REINFORCE && game.reinforcements === 0) {
    game.phase = ATTACK;
    game.emit("phaseChange", { phase: game.phase, player: game.currentPlayer });
  }

  // Attack while probabilities favorable
  while (game.phase === ATTACK) {
    const options = [];
    game.territories
      .filter(t => t.owner === game.currentPlayer && t.armies > 1)
      .forEach(from => {
        from.neighbors.forEach(n => {
          const to = game.territoryById(n);
          if (to.owner !== game.currentPlayer) {
            const prob = attackSuccessProbability(from, to);
            options.push({ from, to, prob });
          }
        });
      });
    if (options.length === 0) break;
    options.sort((a, b) => b.prob - a.prob);
    const best = options[0];
    if (best.prob < 0.6) break;
    const result = game.attack(best.from, best.to);
    game.emit(ATTACK, { from: best.from.id, to: best.to.id, result });
    if (game.phase === GAME_OVER) return;
  }

  // Fortify one army from strong to weak border
  game.endTurn();
  if (game.phase === FORTIFY) {
    let best = null;
    const aiOwned = game.territories.filter(t => t.owner === game.currentPlayer);
    aiOwned.forEach(from => {
      if (from.armies > 1) {
        from.neighbors.forEach(n => {
          const to = game.territoryById(n);
          if (to.owner === game.currentPlayer) {
            const diff = territoryPriority(game, to) - territoryPriority(game, from);
            if (!best || diff > best.diff) best = { from, to, diff };
          }
        });
      }
    });
    if (best && best.diff > 0) {
      game.moveArmies(best.from.id, best.to.id, 1);
    }
    game.endTurn();
  }
}

export default function aiTurnManager(game) {
  game.performAITurn = () => performAITurn(game);
}

