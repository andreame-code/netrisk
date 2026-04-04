# E2E Acceptance Tests

NetRisk acceptance tests use Playwright and live in `e2e/`, separate from the unit tests run by `scripts/run-tests.cjs`.

## Run locally

- Run the E2E suite:
  - `npm.cmd run test:e2e`
- Update visual baselines intentionally:
  - `npm.cmd run test:e2e:update`

The E2E runner starts its own server instance.
If the default port `3100` is already in use, it automatically selects the next free local port instead of reusing or stopping the running process.
Each run also uses a temporary SQLite database dedicated to that E2E instance, and the temporary database files are cleaned up automatically before and after the run.

## Scope today

- smoke test for app load
- main layout acceptance coverage
- basic territory interaction coverage
- one visual baseline for the main shell
