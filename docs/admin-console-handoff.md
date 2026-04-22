# Admin Console Handoff

## What Was Implemented

- a protected admin React route at `/admin` with sidebar navigation and section-based admin shell
- server-side admin APIs for overview, users, games, config, maintenance, and audit log
- persistent global admin defaults applied to new game creation without breaking module/profile/preset runtime precedence
- persistent audit logging for core admin mutations
- guarded admin actions for user role changes, lobby close, game termination, game config repair, and stale lobby cleanup
- maintenance and diagnostics flows for broken references, stale lobbies, and snapshot/config inspection

## Routes And Pages Added

- `/admin/*`
- `/react/admin/*`

## APIs Added

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `POST /api/admin/users/role`
- `GET /api/admin/games`
- `GET /api/admin/games/:gameId`
- `POST /api/admin/games/action`
- `GET /api/admin/config`
- `PUT /api/admin/config`
- `GET /api/admin/maintenance`
- `POST /api/admin/maintenance`
- `GET /api/admin/audit`

## Database Model And Config Changes

- new app-state key `adminConsoleConfig` for global admin defaults and maintenance thresholds
- new app-state key `adminAuditLog` for lightweight persistent audit history
- admin capability `admin:manage`
- module disable protection now also checks admin defaults before allowing a module to be turned off

## Tests Added

- admin route integration coverage in `frontend/react-shell/src/__tests__/admin-route.integration.test.tsx` for route gating, section rendering, and admin mutation wiring
- backend regression coverage in `tests/gameplay/regression/admin-console-routes.test.cts` for role mutation, config/runtime preservation, anonymous/non-admin protection, destructive confirmation enforcement, and failed-action audit logging
- Vercel/admin route rewrite coverage in `tests/gameplay/regression/vercel-routing-config.test.cts`

## Biggest Compromises

- audit logging is stored in app state instead of a dedicated append-only audit table
- the runtime/modules page currently reuses the existing module admin component instead of a newly split admin-specific module screen
- destructive confirmations are prompt-based in the first UI slice rather than custom modal flows

## Biggest Risks

- audit history is bounded and lightweight, so long-term compliance-style retention is not solved yet
- maintenance and repair tools currently cover the most obvious consistency failures, but not every future module/schema drift case
- the admin shell is fully usable, but it is still a first operational console rather than a complete back-office product

## Recommended Next Steps

1. move audit logging to a dedicated datastore surface with filtering and pagination
2. add richer module/runtime repair and remap flows for invalid references
3. replace prompt-based confirmations with explicit admin confirmation dialogs
4. add pagination and bulk actions for larger user/game datasets
5. add targeted browser E2E coverage for the most sensitive destructive admin flows

## Remaining Gaps Ranked By Impact

1. durable audit/history storage and review ergonomics
2. deeper repair/remap tooling for future runtime-module migration cases
3. richer admin UX for destructive confirmations and bulk operations
4. pagination, sorting, and larger-scale operational filters

## PR Status

- branch: `codex/admin-console`
- recent commits:
  - `e994fc4` `Fix admin console regressions and CI stability`
  - `8547f38` `Honor admin piece set defaults in game setup`
  - `8744b84` `Decouple admin piece-set defaults from explicit rule sets`
  - `feb762b` `Add admin console permission and confirmation regressions`
- draft PR: `#139` `[codex] Build admin console`
- PR URL: `https://github.com/andreame-code/netrisk/pull/139`
- latest local validation on `feb762b`:
  - `npm run build:ts`: success
  - `node .tsbuild/scripts/run-gameplay-tests.cjs`: success
  - `npm run test:react`: success
  - `npm run format:check`: success
  - `npm run lint`: success with pre-existing warnings only
- latest hardening validated before this handoff refresh:
  - admin defaults still seed omitted new-game fields without overriding explicit content-pack or rule-set driven defaults
  - stale lobby cleanup re-checks loaded game phase before mutating a game discovered as stale
  - `/api/game/options` degrades safely when persisted admin defaults contain invalid runtime references
  - admin mutation routes reject both anonymous and authenticated non-admin callers
  - destructive admin actions fail closed without confirmation and write failure audit entries
- remote PR state verified on `2026-04-22`:
  - `mergeable`: `MERGEABLE`
  - `mergeStateStatus`: `CLEAN`
  - checks green: `coverage`, `quality`, `e2e-smoke`, `CodeQL`, `Vercel`, `Vercel Preview Comments`
  - latest Codex confirmation: `https://github.com/andreame-code/netrisk/pull/139#issuecomment-4296016695`
