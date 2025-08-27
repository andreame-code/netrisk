import { attackSuccessProbability, territoryPriority } from "../ai.js";
import { REINFORCE, ATTACK, FORTIFY, GAME_OVER } from "../phases.js";

function getProfile(player) {
  const diffSettings = {
    easy: { attackThreshold: 0.8, target: "random", card: 0.5 },
    normal: { attackThreshold: 0.6, target: "best", card: 1 },
    hard: { attackThreshold: 0.5, target: "best", card: 1 },
  };
  const styleMod = {
    aggressive: -0.1,
    defensive: 0.1,
    balanced: 0,
  };
  const difficulty = diffSettings[player.difficulty] || diffSettings.normal;
  const style = player.style || "balanced";
  return {
    attackThreshold: Math.max(
      0,
      difficulty.attackThreshold + (styleMod[style] || 0),
    ),
    target: difficulty.target,
    card: difficulty.card,
    style,
  };
}

export function performAITurn(game) {
  const player = game.players[game.currentPlayer];
  if (!player.ai || game.phase === GAME_OVER) return;
  const profile = getProfile(player);
  // Play cards if possible
  const hand = game.hands[game.currentPlayer];
  const set = game.findValidSet(hand);
  if (set && Math.random() < profile.card) game.playCards(set);

  // Reinforce prioritizing territories
  while (game.reinforcements > 0) {
    const owned = game.territories.filter(t => t.owner === game.currentPlayer);
    if (owned.length === 0) break;
    const target = owned.reduce((best, t) => {
      const score = territoryPriority(game, t, profile);
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
    const candidates = options.filter(o => o.prob >= profile.attackThreshold);
    if (candidates.length === 0) break;
    let choice;
    if (profile.target === "random") {
      choice = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      candidates.sort((a, b) => b.prob - a.prob);
      choice = candidates[0];
    }
    const result = game.attack(choice.from, choice.to);
    game.emit(ATTACK, { from: choice.from.id, to: choice.to.id, result });
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
            const diff =
              territoryPriority(game, to, profile) -
              territoryPriority(game, from, profile);
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

