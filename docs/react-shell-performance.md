# React shell initial-transfer budget

The production build measures the JavaScript and CSS required for the first render of the public landing page and lobby. For each route, the measurement includes the entry chunk, the route entry, every static JavaScript import in that closure, and the CSS attached to those chunks. Gzip is calculated per emitted file, matching separate HTTP transfers.

## Baseline and result

The baseline was recorded from `main` at `891f48f67e1553d2ae30a5cab25155505f71b8c2` before the split:

| Route   | Baseline JS raw / gzip | Current JS raw / gzip | Baseline CSS raw / gzip | Current CSS raw / gzip |
| ------- | ---------------------: | --------------------: | ----------------------: | ---------------------: |
| Landing |     664.15 / 189.43 kB |    518.48 / 145.85 kB |       345.00 / 52.86 kB |      179.20 / 30.05 kB |
| Lobby   |     693.09 / 197.05 kB |    596.97 / 170.03 kB |       345.00 / 52.86 kB |      345.00 / 52.86 kB |

The landing and authenticated shell are selected through dynamic entries. Sentry is loaded after the initial render during an idle window (or immediately for the first reportable error). The direct landing omits `game-layout.css`; the lazy authenticated-shell CSS entry preserves the established stylesheet order because `game-layout.css` also contains shared lobby, profile, and new-game layouts and the shell can navigate back to the landing without a document reload.

## Enforced budgets

| Route   | Initial JS gzip | Initial CSS gzip |
| ------- | --------------: | ---------------: |
| Landing |          155 kB |            33 kB |
| Lobby   |          180 kB |            55 kB |

`npm run build:react-shell` and the normal production/CI build print raw and gzip measurements, then fail with a route-specific error if a budget is exceeded. The budget implementation lives in `frontend/react-shell/performance-budget.ts`.

## Largest modules remaining in the entry

The build reports the ten largest rendered module contributions before final minification. At the time of this baseline the largest are:

| Module                           | Rendered contribution |
| -------------------------------- | --------------------: |
| `react-dom-client.production.js` |             452.14 kB |
| Italian locale catalog           |              49.98 kB |
| English locale catalog           |              47.94 kB |
| German locale catalog            |              31.54 kB |
| Spanish locale catalog           |              30.99 kB |
| `react.production.js`            |              15.10 kB |

React DOM is required to mount every route. The locale catalogs remain shared because the current translation API is synchronous; moving them behind locale-specific async boundaries is a separate architectural change and is intentionally not hidden by the budget.
