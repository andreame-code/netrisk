const gameplayTestModules = [
  "./setup/game-setup.test.cjs",
  "./turn-flow/turn-flow.test.cjs",
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
  "./regression/attack-route-guard.test.cjs"
];

gameplayTestModules.forEach((modulePath) => {
  require(modulePath);
});
