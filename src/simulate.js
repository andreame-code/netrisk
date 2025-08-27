(async () => {
  const { default: Game } = await import('./game.js');
  const { default: aiTurnManager } = await import('./ai/turn-manager.js');
  const { GAME_OVER } = await import('./phases.js');

  async function runSimulations(count = 100) {
    let wins = [0, 0];
    const profile = { difficulty: 'normal', style: 'balanced' };
    for (let i = 0; i < count; i++) {
      const players = [
        { name: 'AI 1', color: '#f00', ai: true, ...profile },
        { name: 'AI 2', color: '#0f0', ai: true, ...profile },
      ];
      const g = await Game.create(players);
      aiTurnManager(g);
      while (g.phase !== GAME_OVER) {
        g.performAITurn();
      }
      const winner = g.checkVictory();
      if (winner !== null) wins[winner] += 1;
    }
    return wins;
  }

  const results = await runSimulations(100);
  console.log('Simulation results (Normal/Balanced, 100 games):', results);
})();
