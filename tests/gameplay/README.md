# Gameplay Tests

This suite covers backend engine behavior and game rules, separately from Playwright E2E tests.

## Command

`npm run test:gameplay`

The command builds the current TypeScript sources first and then runs the gameplay harness in `scripts/run-gameplay-tests.cts`.

## Structure

- `ai`: AI decision-making, turn execution, and forced behavior
- `helpers`: builders and deterministic random utilities
- `setup`: game initialization
- `turn-flow`: phase and turn transitions
- `reinforcement`: reinforcement calculation and placement
- `combat`: attack validation and dice resolution
- `conquest`: conquest and army transfer
- `fortify`: fortification movement
- `victory`: elimination and victory
- `shared`: shared runtime validation and cross-layer contract helpers
- `regression`: representative multi-module flows, admin/Content Studio routes, scheduler services, route regressions, and repository guardrails such as the TS source allowlist

## Notes for contributors

- Gameplay tests are registered explicitly by the harness, so adding a new test file also requires wiring it into `scripts/run-gameplay-tests.cts`.
- This suite is the right place for engine rules, module-runtime regressions, and deterministic repository checks that do not need a browser.
- Admin APIs, authored content, scheduler services, and datastore-sensitive route behavior belong here when they can be verified without Playwright.
- Browser-independent frontend/backend contract tests for the typed HTTP client live in `scripts/run-tests.cts`, not in this gameplay harness.
