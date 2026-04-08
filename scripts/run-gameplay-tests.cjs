const path = require("path");

process.env.TEST = "true";

const tests = [];

global.register = function register(name, fn) {
  tests.push({ name, fn });
};

[
  "../tests/gameplay/ai/ai-player.test.cjs",
  "../tests/gameplay/all.test.cjs"
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
