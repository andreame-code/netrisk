# React Migration Matrix

This matrix tracks the completed React cutover after the legacy rollback namespace cleanup.
The canonical user-facing routes are served by the React shell, and `/react/*` remains a supported alias namespace.

## Route Matrix

| Surface | User-facing features | Backend/API boundary | Required UI states | Existing coverage | Current gap to close | Cutover criteria |
| --- | --- | --- | --- | --- | --- | --- |
| `/` and `/react/` | marketing shell, top-nav session affordances, route handoff | session restore only | load, unauthenticated, authenticated, locale/theme application | `e2e/smoke/app-load.spec.ts`, layout visuals, shell routing integration | canonical cutover is complete | Canonical landing stays React-served while `/react/*` remains a supported alias |
| `/login` and `/react/login` | legacy-parity sign-in form, next-path redirect, authenticated redirect, top-nav auth affordances | `/api/auth/login`, `/api/auth/session` | load, validation error, success redirect, already-authenticated redirect | auth navigation E2E, header blueprint layout coverage, shell routing integration | canonical cutover is complete | Canonical login stays React-served while `/react/*` remains a supported alias |
| `/register.html` and `/react/register` | register form, login handoff, redirect to profile | `/api/auth/register`, `/api/auth/session` | load, validation error, success redirect, already-authenticated redirect | React register integration + smoke via shared auth flows | canonical cutover is complete | Canonical register stays React-served while `/react/*` remains a supported alias |
| `/lobby.html` and `/react/lobby` | list games, infinite scroll, selected-session detail, open/join, reopen active game | `/api/games`, `/api/games/open`, `/api/join` | loading, empty, error, guest inline auth state, refresh | React route tests, lobby smoke and visuals | canonical cutover is complete | Canonical lobby stays React-served and both canonical + `/react/*` paths pass parity checks |
| `/new-game.html` and `/react/lobby/new` | content packs, presets, profiles, advanced options, player slots, validation | `/api/game/options`, `/api/games` | loading, invalid remote payload, validation error, success redirect, guest inline auth state | React shell smoke, E2E new-game happy path + validation fallback, visual/layout suites | canonical cutover is complete | React route supports module/preset-heavy setup without raw fetches and both canonical + `/react/*` paths pass parity checks |
| `/profile.html` and `/react/profile` | stats, participating games, theme preference, admin module controls, admin slots | `/api/profile`, `/api/profile/preferences/theme`, `/api/modules`, `/api/modules/options`, `/api/modules/:id/(enable|disable)`, `/api/modules/rescan` | loading, error, empty history, theme save error, admin catalog refresh/toggle states | React profile integration tests, profile E2E states | canonical cutover is complete | React profile covers user and admin surfaces on canonical + `/react/*` routes |
| `/game/:id` and `/react/game/:id` | join/start, SSE sync, reinforcement, attack, conquest, move-after-conquest, cards, fortify, surrender, conflict recovery, map controls | `/api/state`, `/api/events`, `/api/start`, `/api/action`, `/api/cards/trade`, `/api/join` | loading, error, reconnecting, version conflict, forced trade, direct route refresh | gameplay E2E, gameplay route smoke, gameplay engine suite | canonical cutover is complete | React gameplay owns the full in-game shell on canonical + `/react/*` routes |

## Cross-Cutting Guardrails

| Area | Rule | Evidence |
| --- | --- | --- |
| HTTP boundary | `frontend/src/core/api/*` stays the only typed HTTP client | New module/admin flows were added there instead of inline `fetch` calls |
| Shared transport schema | New payloads are added once in `shared/runtime-validation.cts` and consumed by React via generated validation | Module catalog/options payloads now have shared schemas |
| Game rules | React must never reproduce backend rule validation | Gameplay migration rows remain UI/state only; engine coverage stays in `tests/gameplay` |
| Alias support | Canonical and `/react/*` paths share one React contract without a separate rollback frontend namespace | Rows above define the steady-state route contract |

## Validation Gate by Slice

| Slice | Minimum local gate |
| --- | --- |
| Shared schema or client boundary | `npm test`, `npm run test:react` |
| React route parity change | `npm run test:react` plus touched-route E2E |
| Gameplay cutover or legacy removal | `npm run test:all:e2e` |
| URL cutover | `npm run test:all:e2e` plus green CI/preview |
