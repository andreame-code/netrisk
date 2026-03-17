# E2E Acceptance Tests

NetRisk acceptance tests use Playwright and live in `e2e/`, separate from the unit tests run by `scripts/run-tests.cjs`.

## Run locally

- Run the E2E suite:
  - `npm.cmd run test:e2e`
- Update visual baselines intentionally:
  - `npm.cmd run test:e2e:update`

## Scope today

- smoke test for app load
- main layout acceptance coverage
- basic territory interaction coverage
- one visual baseline for the main shell
