# Admin Console

The NetRisk administrator area lives at `/admin`, with `/react/admin` kept as the supported alias for the same React shell.

## Access model

- only authenticated users with role `admin` can open the admin route
- the Admin navigation entry is hidden for non-admin users
- all admin APIs enforce server-side authorization through `admin:manage`
- destructive actions require explicit confirmation in the UI and are validated again on the server

## Available sections

- `Overview`: operational summary, recent games, active defaults, and detected issues
- `Users`: searchable user directory with role inspection and admin promote/demote
- `Games`: searchable list of games/lobbies, issue summary, player/config inspection, raw state view, close/terminate/repair actions
- `Configurations`: global admin defaults, enabled modules, profiles, runtime defaults, and maintenance thresholds
- `Runtime / Modules`: module catalog management through the existing module admin tooling
- `Content Studio`: constrained authoring for gameplay modules; currently supports `victory-objectives`
- `Maintenance`: validation report and guarded cleanup/repair actions
- `System Health`: diagnostics view for module references, game snapshots, stale lobbies, and maintenance findings
- `Audit Log`: persistent log of admin mutations with actor, action, target, and result

## Local development admin bootstrap

1. Start the app and register a normal account.
2. Promote that account locally:

```bash
npm run admin:grant -- --username your_username
```

3. Refresh the session or log in again.
4. Open `http://localhost:3000/admin`.

Notes:

- the script defaults to role `admin`
- to demote again, run `npm run admin:grant -- --username your_username --role user`
- by default the script uses the same local SQLite datastore as the app (`data/netrisk.sqlite`)
- if you need a different store, pass `--driver`, `--db-file`, `--data-file`, `--games-file`, or `--sessions-file`

## Persistence

- admin defaults are stored in `app_state` under `adminConsoleConfig`
- audit entries are stored in `app_state` under `adminAuditLog`
- authored Content Studio modules are stored in `app_state` under `authoredGameplayModules`
- game repair actions update stored snapshots only through server-side normalization helpers

## Safety notes

- module disable now refuses when the module is still referenced by admin defaults
- Content Studio modules are schema-validated server-side before publish/enable and never execute arbitrary uploaded code
- game repair preserves runtime-resolved IDs while synchronizing stale top-level snapshot fields
- cleanup and destructive actions are audit logged on both success and failure paths where applicable

## Regression coverage

- `frontend/react-shell/src/__tests__/admin-route.integration.test.tsx` verifies admin route gating, non-admin navigation hiding, and overview-shell loading in the React shell
- `tests/gameplay/regression/admin-console-routes.test.cts` verifies admin API protection for anonymous and non-admin callers, role mutation, destructive confirmation enforcement, failure audit logging, maintenance actions, and admin-default runtime preservation
- `tests/gameplay/regression/admin-content-studio-routes.test.cts` verifies authored module route protection, validation, publish/enable/disable behavior, and runtime integration
- `tests/gameplay/regression/vercel-routing-config.test.cts` verifies `/admin` and `/react/admin` continue to route correctly through the deployed rewrite layer

Notable backend regressions covered today:

- create-game requests that provide an explicit `ruleSetId` but omit `pieceSetId` still preserve valid admin defaults for piece sets
- destructive admin actions fail closed without explicit confirmation and emit audit entries on the failure path
- anonymous and authenticated non-admin callers receive `AUTH_REQUIRED` or `ADMIN_ONLY` on protected admin mutations
