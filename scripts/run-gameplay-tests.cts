import type * as NodePathTypes from "node:path";
const path = require("node:path") as typeof NodePathTypes;

type GameplayTest = {
  name: string;
  fn: () => unknown | Promise<unknown>;
};

process.env.TEST = "true";

const tests: GameplayTest[] = [];

(
  global as typeof globalThis & {
    register?: (name: string, fn: GameplayTest["fn"]) => void;
  }
).register = function register(name: string, fn: GameplayTest["fn"]) {
  tests.push({ name, fn });
};

const gameplayTestModules = [
  "../tests/gameplay/shared/map-graph.test.cjs",
  "../tests/gameplay/shared/map-loader.test.cjs",
  "../tests/gameplay/shared/typed-map-data.test.cjs",
  "../tests/gameplay/shared/continent-loader.test.cjs",
  "../tests/gameplay/shared/extensions.test.cjs",
  "../tests/gameplay/shared/core-base-catalog.test.cjs",
  "../tests/gameplay/shared/version-registry.test.cjs",
  "../tests/gameplay/shared/module-versions.test.cjs",
  "../tests/gameplay/shared/runtime-validation.test.cjs",
  "../tests/gameplay/shared/module-registry.test.cjs",
  "../tests/gameplay/ai/ai-player.test.cjs",
  "../tests/gameplay/ai/ai-turn-recovery.test.cjs",
  "../tests/gameplay/setup/game-setup.test.cjs",
  "../tests/gameplay/setup/new-game-config.test.cjs",
  "../tests/gameplay/turn-flow/turn-flow.test.cjs",
  "../tests/gameplay/turn-flow/turn-timeout.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-calculation.test.cjs",
  "../tests/gameplay/reinforcement/map-continent-bonuses.test.cjs",
  "../tests/gameplay/reinforcement/reinforcement-placement.test.cjs",
  "../tests/gameplay/combat/attack-validation.test.cjs",
  "../tests/gameplay/combat/attack-resolution.test.cjs",
  "../tests/gameplay/combat/combat-resolution.test.cjs",
  "../tests/gameplay/combat/banzai-attack.test.cjs",
  "../tests/gameplay/conquest/conquest-resolution.test.cjs",
  "../tests/gameplay/fortify/fortify-engine.test.cjs",
  "../tests/gameplay/fortify/fortify-movement.test.cjs",
  "../tests/gameplay/victory/victory-detection.test.cjs",
  "../tests/gameplay/victory/elimination-and-victory.test.cjs",
  "../tests/gameplay/regression/full-flows.test.cjs",
  "../tests/gameplay/regression/game-management-routes.test.cjs",
  "../tests/gameplay/regression/game-summary-stores.test.cjs",
  "../tests/gameplay/regression/module-runtime.test.cjs",
  "../tests/gameplay/regression/admin-console-routes.test.cjs",
  "../tests/gameplay/regression/admin-content-studio-routes.test.cjs",
  "../tests/gameplay/regression/admin-route-validation.test.cjs",
  "../tests/gameplay/regression/auth-store.test.cjs",
  "../tests/gameplay/regression/authorization-rules.test.cjs",
  "../tests/gameplay/regression/authored-modules.test.cjs",
  "../tests/gameplay/regression/canonical-game-route-redirect.test.cjs",
  "../tests/gameplay/regression/codex-pr-readiness.test.cjs",
  "../tests/gameplay/regression/finished-game-retention.test.cjs",
  "../tests/gameplay/regression/session-cookie-persistence.test.cjs",
  "../tests/gameplay/regression/startup-init-error.test.cjs",
  "../tests/gameplay/regression/retired-runtime-assets.test.cjs",
  "../tests/gameplay/regression/tooling-and-supabase-regressions.test.cjs",
  "../tests/gameplay/regression/check-no-js-sources.test.cjs",
  "../tests/gameplay/regression/vercel-routing-config.test.cjs",
  "../tests/gameplay/regression/account-validation-routes.test.cjs",
  "../tests/gameplay/regression/setup-service.test.cjs",
  "../tests/gameplay/regression/attack-route-guard.test.cjs",
  "../tests/gameplay/regression/game-actions-basic-route.test.cjs",
  "../tests/gameplay/regression/game-read-routes.test.cjs",
  "../tests/gameplay/regression/game-overview-route.test.cjs",
  "../tests/gameplay/regression/modules-routes.test.cjs",
  "../tests/gameplay/regression/event-broadcast.test.cjs",
  "../tests/gameplay/verify_error_masking.test.cjs"
];

gameplayTestModules.forEach((relativePath) => {
  require(path.join(__dirname, relativePath));
});

void (async function run() {
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
