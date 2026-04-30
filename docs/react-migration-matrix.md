# React Route Contract

The React cutover is complete. NetRisk now serves a single React shell on the canonical routes:
`/`, `/login`, `/register`, `/lobby`, `/lobby/new`, `/profile`, `/game`, and `/game/:gameId`.

`/react/*` remains a supported alias namespace for the same shell.

## Supported Surfaces

| Surface | Contract |
| --- | --- |
| `/` and `/react/` | marketing landing and session bootstrap |
| `/login` and `/react/login` | sign-in flow with `next` redirect handling |
| `/register` and `/react/register` | registration and authenticated redirect handling |
| `/lobby` and `/react/lobby` | lobby list, selection, join/open flows |
| `/lobby/new` and `/react/lobby/new` | game creation with presets, profiles, and validation |
| `/admin/*` and `/react/admin/*` | admin console, Content Studio, modules, maintenance, audit, and system-health sections |
| `/profile` and `/react/profile` | player profile, theme preference, admin module controls |
| `/unauthorized` and `/react/unauthorized` | predictable fallback for protected routes |
| `/game`, `/game/:gameId`, `/react/game`, `/react/game/:gameId` | gameplay shell, SSE sync, actions, and recovery flows |

## Deprecated URLs

| URL family | Behavior |
| --- | --- |
| Root `*.html` documents such as `/index.html`, `/register.html`, `/lobby.html`, `/game.html` | no longer supported as entrypoints |
| `/legacy`, `/legacy/`, `/legacy/*.html` | redirected only when a canonical React equivalent exists |
| `/legacy/*.mjs`, `/legacy/*.css`, `/legacy/generated/*`, and unknown `/legacy/*` paths | return `404` |

## Guardrails

| Area | Rule |
| --- | --- |
| HTTP boundary | `frontend/src/core/api/*` remains the only typed client boundary |
| Shared transport schema | shared payload validation stays centralized in `shared/runtime-validation.cts` |
| Game rules | rule validation remains exclusively in the backend engine |
| Alias support | canonical routes and `/react/*` stay behaviorally aligned |

## Validation Gate

Route-contract changes should pass `npm run test:react` and `npm run test:all`.
