const path = require("path");

const tests = [];

global.register = function register(name, fn) {
  tests.push({ name, fn });
};

[
  "../tests/gameplay/setup/game-setup.test.cjs",
  "../tests/gameplay/turn-flow/turn-flow.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-calculation.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-placement.test.cjs",
  "../tests/gameplay/combat/attack-validation.test.cjs",
  "../tests/gameplay/combat/combat-resolution.test.cjs",
  "../tests/gameplay/conquest/conquest-resolution.test.cjs",
  "../tests/gameplay/fortify/fortify-movement.test.cjs",
  "../tests/gameplay/victory/elimination-and-victory.test.cjs",
  "../tests/gameplay/regression/full-flows.test.cjs"
].forEach((relativePath) => {
  require(path.join(__dirname, relativePath));
});

(async function run() {
  let failures = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} gameplay test non superati.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${tests.length} gameplay test superati.`);
})();
