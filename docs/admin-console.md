# Admin Console

The first usable NetRisk administrator area now lives at `/admin`, with `/react/admin` kept as the supported alias while the React shell transition continues.

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
- `Maintenance`: validation report and guarded cleanup/repair actions
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
- game repair actions update stored snapshots only through server-side normalization helpers

## Safety notes

- module disable now refuses when the module is still referenced by admin defaults
- game repair preserves runtime-resolved IDs while synchronizing stale top-level snapshot fields
- cleanup and destructive actions are audit logged on both success and failure paths where applicable
