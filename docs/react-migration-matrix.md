# React Migration Matrix

This matrix is the phase-0 baseline for the gradual migration to a 100% React frontend with safe dual-run support.
The legacy pages remain the reference behavior until each row reaches its cutover criteria.

## Route Matrix

| Surface | User-facing features | Backend/API boundary | Required UI states | Existing coverage | Current gap to close | Cutover criteria |
| --- | --- | --- | --- | --- | --- | --- |
| `/` landing | marketing shell, top-nav session affordances, route handoff | session restore only | load, unauthenticated, authenticated, locale/theme application | `e2e/smoke/app-load.spec.ts`, layout visuals | React route not present yet; shared header/session model still legacy-led | React landing matches shell/header behavior and preserves public navigation without using legacy markup |
| `/register.html` | register form, login handoff, redirect to profile | `/api/auth/register`, `/api/auth/session` | load, validation error, success redirect, already-authenticated redirect | legacy smoke via shared auth flows | React register route missing | React register covers creation + redirect and legacy page can become fallback only |
| `/lobby.html` and `/react/lobby` | list games, infinite scroll, selected-session detail, open/join, reopen active game | `/api/games`, `/api/games/open`, `/api/join` | loading, empty, error, auth redirect, refresh | React route tests, lobby smoke, legacy and React E2E flows, visuals | canonical route still legacy; dual-run assertions are implicit rather than tracked | React route covers the canonical lobby journey and passes targeted legacy + React E2E parity checks |
| `/new-game.html` and `/react/lobby/new` | content packs, presets, profiles, advanced options, player slots, validation | `/api/game/options`, `/api/games` | loading, invalid remote payload, validation error, success redirect, auth redirect | React shell smoke, E2E new-game happy path + validation fallback | React route still needs to remain the main parity target for module-heavy setup permutations | React route supports module/preset-heavy setup without raw fetches or legacy-only affordances |
| `/profile.html` and `/react/profile` | stats, participating games, theme preference, admin module controls, admin slots | `/api/profile`, `/api/profile/preferences/theme`, `/api/modules`, `/api/modules/options`, `/api/modules/:id/(enable|disable)`, `/api/modules/rescan` | loading, error, empty history, theme save error, admin catalog refresh/toggle states | React profile integration tests, profile E2E states | admin/module controls were legacy-only before this tranche | React profile covers user and admin surfaces and no longer needs legacy profile for operational module management |
| `/game/:id` and `/react/game/:id` | join/start, SSE sync, reinforcement, attack, conquest, move-after-conquest, cards, fortify, surrender, conflict recovery, map controls | `/api/state`, `/api/events`, `/api/start`, `/api/action`, `/api/cards/trade`, `/api/join` | loading, error, reconnecting, version conflict, forced trade, direct route refresh | gameplay E2E on legacy and React, gameplay route smoke, gameplay engine suite | map/secondary sidebars still advertise legacy fallback | React gameplay must remove the remaining `Legacy fallback` affordances and own the full in-game shell |

## Cross-Cutting Guardrails

| Area | Rule | Evidence |
| --- | --- | --- |
| HTTP boundary | `frontend/src/core/api/*` stays the only typed HTTP client | New module/admin flows were added there instead of inline `fetch` calls |
| Shared transport schema | New payloads are added once in `shared/runtime-validation.cts` and consumed by React via generated validation | Module catalog/options payloads now have shared schemas |
| Game rules | React must never reproduce backend rule validation | Gameplay migration rows remain UI/state only; engine coverage stays in `tests/gameplay` |
| Dual run | Legacy stays available until React cutover criteria are met | Rows above define route-by-route exit criteria instead of a big-bang switch |

## Validation Gate by Slice

| Slice | Minimum local gate |
| --- | --- |
| Shared schema or client boundary | `npm test`, `npm run test:react` |
| React route parity change | `npm run test:react` plus touched-route E2E |
| Gameplay cutover or legacy removal | `npm run test:all:e2e` |
| URL cutover | `npm run test:all:e2e` plus green CI/preview |
