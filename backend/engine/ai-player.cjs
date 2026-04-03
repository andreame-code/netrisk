const {
  TurnPhase,
  applyFortify,
  applyReinforcement,
  endTurn,
  getCurrentPlayer,
  moveAfterConquest,
  resolveAttack,
  territories,
  territoriesOwnedBy
} = require("./game-engine.cjs");

function getMapTerritories(state) {
  return Array.isArray(state && state.mapTerritories) && state.mapTerritories.length
    ? state.mapTerritories
    : territories;
}

function listEnemyNeighbors(state, territoryId, playerId) {
  const territory = getMapTerritories(state).find((item) => item.id === territoryId);
  if (!territory) {
    return [];
  }

  return territory.neighbors
    .map((neighborId) => ({ territoryId: neighborId, state: state.territories[neighborId] }))
    .filter((entry) => entry.state && entry.state.ownerId && entry.state.ownerId !== playerId);
}

function chooseReinforcementTarget(state, playerId) {
  const owned = territoriesOwnedBy(state, playerId);
  if (!owned.length) {
    return null;
  }

  const ranked = owned
    .map((territory) => {
      const enemyNeighbors = listEnemyNeighbors(state, territory.id, playerId);
      const armies = state.territories[territory.id].armies;
      const strongestEnemy = enemyNeighbors.reduce((max, entry) => Math.max(max, entry.state.armies), 0);
      const score = enemyNeighbors.length
        ? (armies - strongestEnemy) + enemyNeighbors.length * 2
        : -100 + armies;

      return {
        territoryId: territory.id,
        enemyNeighbors,
        score,
        armies
      };
    })
    .sort((left, right) => right.score - left.score || right.armies - left.armies || left.territoryId.localeCompare(right.territoryId));

  return ranked[0] ? ranked[0].territoryId : null;
}

function chooseAttack(state, playerId) {
  const candidates = [];

  territoriesOwnedBy(state, playerId).forEach((territory) => {
    const fromState = state.territories[territory.id];
    if (!fromState || fromState.armies < 2) {
      return;
    }

    listEnemyNeighbors(state, territory.id, playerId).forEach((neighbor) => {
      const advantage = fromState.armies - neighbor.state.armies;
      if (advantage < 2) {
        return;
      }

      candidates.push({
        fromId: territory.id,
        toId: neighbor.territoryId,
        score: advantage * 10 - neighbor.state.armies
      });
    });
  });

  candidates.sort((left, right) => right.score - left.score || left.fromId.localeCompare(right.fromId) || left.toId.localeCompare(right.toId));
  return candidates[0] || null;
}

function chooseConquestMove(state, playerId, pending) {
  if (!pending) {
    return null;
  }

  const capturedEnemyNeighbors = listEnemyNeighbors(state, pending.toId, playerId).length;
  if (!capturedEnemyNeighbors) {
    return pending.minArmies;
  }

  return Math.max(
    pending.minArmies,
    Math.min(pending.maxArmies, 2)
  );
}

function chooseFortify(state, playerId) {
  const owned = territoriesOwnedBy(state, playerId);
  const borderIds = new Set(
    owned
      .filter((territory) => listEnemyNeighbors(state, territory.id, playerId).length > 0)
      .map((territory) => territory.id)
  );

  if (!borderIds.size) {
    return null;
  }

  const candidates = [];
  owned.forEach((territory) => {
    const fromState = state.territories[territory.id];
    if (!fromState || fromState.armies <= 1) {
      return;
    }

    const territoryDef = getMapTerritories(state).find((item) => item.id === territory.id);
    if (!territoryDef) {
      return;
    }

    territoryDef.neighbors.forEach((neighborId) => {
      if (!borderIds.has(neighborId)) {
        return;
      }

      const neighborState = state.territories[neighborId];
      if (!neighborState || neighborState.ownerId !== playerId) {
        return;
      }

      const sourceIsBorder = borderIds.has(territory.id);
      if (sourceIsBorder) {
        return;
      }

      const targetEnemyNeighbors = listEnemyNeighbors(state, neighborId, playerId).length;
      const movableArmies = fromState.armies - 1;
      const armies = Math.max(1, Math.min(movableArmies, 2));
      const score = 8 + targetEnemyNeighbors * 4 + (fromState.armies - neighborState.armies);
      if (score < 3) {
        return;
      }

      candidates.push({ fromId: territory.id, toId: neighborId, armies, score });
    });
  });

  candidates.sort((left, right) => right.score - left.score || right.armies - left.armies || left.fromId.localeCompare(right.fromId) || left.toId.localeCompare(right.toId));
  return candidates[0] || null;
}

function runAiTurn(state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const player = getCurrentPlayer(state);
  if (!player) {
    return { ok: false, error: "Nessun giocatore corrente." };
  }

  if (!player.isAi) {
    return { ok: false, error: "Il giocatore corrente non e controllato dall'AI." };
  }

  if (state.phase !== "active") {
    return { ok: false, error: "La partita non e attiva." };
  }

  const report = {
    ok: true,
    playerId: player.id,
    reinforcementTargets: [],
    attacks: [],
    conquestMoves: [],
    fortify: null,
    endedTurn: false
  };

  let steps = 0;
  while (steps < 64) {
    steps += 1;

    if (state.winnerId || state.phase !== "active") {
      report.endedTurn = true;
      return report;
    }

    const current = getCurrentPlayer(state);
    if (!current || current.id !== player.id) {
      report.endedTurn = true;
      return report;
    }

    if (state.pendingConquest) {
      const pending = state.pendingConquest;
      const armiesToMove = chooseConquestMove(state, player.id, pending);
      const move = moveAfterConquest(state, player.id, armiesToMove);
      if (!move.ok) {
        return { ok: false, error: move.message, report };
      }
      report.conquestMoves.push({ fromId: pending.fromId, toId: pending.toId, armies: armiesToMove });
      continue;
    }

    if (state.reinforcementPool > 0 || state.turnPhase === TurnPhase.REINFORCEMENT) {
      const territoryId = chooseReinforcementTarget(state, player.id);
      if (!territoryId) {
        return { ok: false, error: "AI senza territorio valido per i rinforzi.", report };
      }

      const reinforcement = applyReinforcement(state, player.id, territoryId);
      if (!reinforcement.ok) {
        return { ok: false, error: reinforcement.message, report };
      }

      report.reinforcementTargets.push(territoryId);
      continue;
    }

    if (state.turnPhase === TurnPhase.ATTACK) {
      const attack = chooseAttack(state, player.id);
      if (attack) {
        const result = resolveAttack(state, player.id, attack.fromId, attack.toId, random);
        if (!result.ok) {
          return { ok: false, error: result.message, report };
        }
        report.attacks.push(attack);
        continue;
      }

      const toFortify = endTurn(state, player.id);
      if (!toFortify.ok) {
        return { ok: false, error: toFortify.message, report };
      }
      continue;
    }

    if (state.turnPhase === TurnPhase.FORTIFY) {
      const fortify = chooseFortify(state, player.id);
      if (fortify) {
        const result = applyFortify(state, player.id, fortify.fromId, fortify.toId, fortify.armies);
        if (!result.ok) {
          return { ok: false, error: result.message, report };
        }
        report.fortify = fortify;
      }

      const finished = endTurn(state, player.id);
      if (!finished.ok) {
        return { ok: false, error: finished.message, report };
      }

      report.endedTurn = true;
      return report;
    }

    const fallback = endTurn(state, player.id);
    if (!fallback.ok) {
      return { ok: false, error: fallback.message, report };
    }
  }

  return { ok: false, error: "AI interrompibile: troppi passaggi nel turno.", report };
}

module.exports = {
  chooseAttack,
  chooseConquestMove,
  chooseFortify,
  chooseReinforcementTarget,
  runAiTurn
};
