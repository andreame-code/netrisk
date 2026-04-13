# E2E Acceptance Tests

NetRisk acceptance tests use Playwright and live in `e2e/`, separate from the unit tests run by `scripts/run-tests.cjs`.

## Run locally

- Run the E2E suite:
  - `npm.cmd run test:e2e`
- Run the experimental isolated multi-process split:
  - `npm.cmd run test:e2e:parallel`
- Run the E2E suite in a single serial process:
  - `npm.cmd run test:e2e:serial`
- Run only the fast smoke coverage:
  - `npm.cmd run test:e2e:smoke`
- Run headed for local debugging:
  - `npm.cmd run test:e2e:headed`
- Update visual baselines intentionally:
  - `npm.cmd run test:e2e:update`

The default E2E command keeps the suite on the fastest stable local path for this repository: a single isolated Playwright process, no local video capture, and no local HTML report generation unless explicitly requested.
This keeps the standard command lean without introducing flaky parallelism in a suite that still resets shared game state heavily.

An experimental multi-process split is available through `test:e2e:parallel`.

The serial E2E runner starts its own server instance.
If the default port `3100` is already in use, it automatically selects the next free local port instead of reusing or stopping the running process.
Each run also uses a temporary SQLite database dedicated to that E2E instance, and the temporary database files are cleaned up automatically before and after the run.

## Scope today

- smoke test for app load
- main layout acceptance coverage
- basic territory interaction coverage
- one visual baseline for the main shell
