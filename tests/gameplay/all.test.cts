const gameplayTestModules = [
  "./shared/map-graph.test.cjs",
  "./shared/map-loader.test.cjs",
  "./shared/continent-loader.test.cjs",
  "./setup/game-setup.test.cjs",
  "./turn-flow/turn-flow.test.cjs",
  "./turn-flow/turn-timeout.test.cjs",
  "./reinforcement/reinforcement-calculation.test.cjs",
  "./reinforcement/map-continent-bonuses.test.cjs",
  "./reinforcement/reinforcement-placement.test.cjs",
  "./combat/attack-validation.test.cjs",
  "./combat/combat-resolution.test.cjs",
  "./combat/banzai-attack.test.cjs",
  "./conquest/conquest-resolution.test.cjs",
  "./fortify/fortify-movement.test.cjs",
  "./victory/victory-detection.test.cjs",
  "./victory/elimination-and-victory.test.cjs",
  "./regression/full-flows.test.cjs",
  "./regression/attack-route-guard.test.cjs",
  "./regression/game-read-routes.test.cjs",
  "./regression/event-broadcast.test.cjs"
];

gameplayTestModules.forEach((modulePath) => {
  require(modulePath);
});
