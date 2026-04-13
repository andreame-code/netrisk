const path = require("node:path") as typeof import("node:path");

type GameplayTest = {
  name: string;
  fn: () => unknown | Promise<unknown>;
};

process.env.TEST = "true";

const tests: GameplayTest[] = [];

(global as typeof globalThis & {
  register?: (name: string, fn: GameplayTest["fn"]) => void;
}).register = function register(name: string, fn: GameplayTest["fn"]) {
  tests.push({ name, fn });
};

const gameplayTestModules = [
  "../tests/gameplay/ai/ai-player.test.cjs",
  "../tests/gameplay/setup/game-setup.test.cjs",
  "../tests/gameplay/turn-flow/turn-flow.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-calculation.test.cjs",
  "../tests/gameplay/reinforcement/map-continent-bonuses.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-placement.test.cjs",
  "../tests/gameplay/combat/attack-validation.test.cjs",
  "../tests/gameplay/combat/combat-resolution.test.cjs",
  "../tests/gameplay/combat/banzai-attack.test.cjs",
  "../tests/gameplay/conquest/conquest-resolution.test.cjs",
  "../tests/gameplay/fortify/fortify-movement.test.cjs",
  "../tests/gameplay/victory/victory-detection.test.cjs",
  "../tests/gameplay/victory/elimination-and-victory.test.cjs",
  "../tests/gameplay/regression/full-flows.test.cjs",
  "../tests/gameplay/regression/attack-route-guard.test.cjs",
  "../tests/gameplay/regression/event-broadcast.test.cjs"
];

gameplayTestModules.forEach((relativePath) => {
  require(path.join(__dirname, relativePath));
});

(async function run() {
  let failures = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`PASS ${entry.name}`);
    } catch (error: unknown) {
      failures += 1;
      console.error(`FAIL ${entry.name}`);
      if (error instanceof Error) {
        console.error(error.stack || error.message);
        continue;
      }

      console.error(error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} gameplay test non superati.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${tests.length} gameplay test superati.`);
})();
