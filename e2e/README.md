# E2E Acceptance Tests

NetRisk acceptance tests use Playwright and live in `e2e/`, separate from the unit tests run by `scripts/run-tests.cjs`.

## Run locally

- Run the E2E suite:
  - `npm run test:e2e`
- Run the split multi-process suite explicitly:
  - `npm run test:e2e:split`
- Run the same split runner through the parallel alias:
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
- Run the full local gate with split E2E shards:
  - `npm run test:all:e2e:split`

The default E2E command keeps the suite on the most conservative path for this repository: a single isolated Playwright process, no local video capture, and no local HTML report generation unless explicitly requested.
This keeps debugging straightforward when you need to reproduce a single failing flow exactly as Playwright sees it.

When the full suite becomes too long for a single local run, use `test:e2e:split` or `test:e2e:parallel`: both run isolated Playwright shards with their own backend instance, SQLite database, port, and output folder so shard state never leaks.

The serial E2E runner starts its own server instance.
If the default port `3100` is already in use, it automatically selects the next free local port instead of reusing or stopping the running process.
Each run also uses a temporary SQLite database dedicated to that E2E instance, and the temporary database files are cleaned up automatically before and after the run.

## Scope today

- smoke test for app load
- layout acceptance coverage for main shell, shared headers, and map fit
- gameplay flows for reinforcement, attack/conquest, fortify handoff, surrender, relogin binding, and version conflict
- React gameplay flows on canonical `/game/:gameId` and supported `/react/game/:gameId` links, including join/start, forced trade, and version-conflict recovery
- authorization flows for protected games, direct game routes, and spectator access
- map viewport controls and territory selection flows
- profile states: loading, error, empty, invalid payload fallback, participating games, and theme preference
- React shell bootstrap, protected redirects, and route-level rendering on canonical routes plus `/react/*`
- new game setup happy path plus validation fallback when setup options become invalid
- granular rendering coverage to catch unnecessary panel remounts during gameplay updates
- visual baselines for main screen, secondary pages, mobile shells, and World Classic board layouts

## Notes for contributors

- The default runner starts its own backend instance and should be preferred over pointing Playwright at a manually started local server.
- If you intentionally change visual output, update baselines with `npm run test:e2e:update` in the same branch/PR that introduces the UI change.
- For large implementation steps, the expected local validation gate is `npm run test:all:e2e`.
