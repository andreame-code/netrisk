# E2E Acceptance Tests

NetRisk acceptance tests use Playwright and live in `e2e/`, separate from the unit tests run by `scripts/run-tests.cjs`.

## Run locally

- Run the E2E suite:
  - `npm run test:e2e`
- Run the experimental isolated multi-process split:
  - `npm run test:e2e:parallel`
- Run the E2E suite in a single serial process:
  - `npm run test:e2e:serial`
- Run only the fast smoke coverage:
  - `npm run test:e2e:smoke`
- Run headed for local debugging:
  - `npm run test:e2e:headed`
- Update visual baselines intentionally:
  - `npm run test:e2e:update`
- Run the full local gate:
  - `npm run test:all:e2e`

The default E2E command keeps the suite on the fastest stable local path for this repository: a single isolated Playwright process, no local video capture, and no local HTML report generation unless explicitly requested.
This keeps the standard command lean without introducing flaky parallelism in a suite that still resets shared game state heavily.

An experimental multi-process split is available through `test:e2e:parallel`.

The serial E2E runner starts its own server instance.
If the default port `3100` is already in use, it automatically selects the next free local port instead of reusing or stopping the running process.
Each run also uses a temporary SQLite database dedicated to that E2E instance, and the temporary database files are cleaned up automatically before and after the run.

## Scope today

- smoke test for app load
- layout acceptance coverage for main shell, shared headers, and map fit
- gameplay flows for reinforcement, attack/conquest, fortify handoff, surrender, relogin binding, and version conflict
- authorization flows for protected games, direct game routes, and spectator access
- profile states: loading, error, empty, invalid payload fallback, participating games, and theme preference
- smoke coverage for the parallel React shell served at `/react/`
- new game setup happy path plus validation fallback when setup options become invalid
- granular rendering coverage to catch unnecessary panel remounts during gameplay updates
- visual baselines for main screen, secondary pages, mobile shells, and World Classic board layouts

## Notes for contributors

- The default runner starts its own backend instance and should be preferred over pointing Playwright at a manually started local server.
- If you intentionally change visual output, update baselines with `npm run test:e2e:update` in the same branch/PR that introduces the UI change.
- For large implementation steps, the expected local validation gate is `npm run test:all:e2e`.
