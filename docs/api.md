# NetRisk API Notes

`docs/openapi.json` is the canonical reference for the stable JSON endpoints that are documented as schema-backed or interface-backed contracts.

This companion guide covers public endpoints that are intentionally snapshot-driven, stream-based, or not yet modeled as first-class OpenAPI schemas.

## Transport rules

- Session auth uses the `netrisk_session` cookie.
- Cron auth uses `Authorization: Bearer <CRON_SECRET>`.
- Most game mutations accept `gameId` in the body. Read endpoints may also resolve `gameId` from the query string. If neither is present, the backend falls back to the active game in server memory.
- Game snapshots are server-owned objects. Treat them as opaque documents and read only the fields your client actually needs.
- Localized error responses use the same envelope shape across the backend:

```json
{
  "error": "Human-readable fallback message.",
  "messageKey": "server.example.key",
  "messageParams": {},
  "code": "OPTIONAL_CODE"
}
```

- Request validation failures add `validationErrors` and use `code: "REQUEST_VALIDATION_FAILED"`.
- Optimistic concurrency conflicts return `409` with `code: "VERSION_CONFLICT"`, `currentVersion`, and a fresh `state` snapshot.

## Endpoints outside the OpenAPI artifact

### `GET /api/state`

- Returns the current game snapshot or the snapshot for `?gameId=<id>`.
- Creator-bound games require a valid session; open games can be read without auth.
- Before responding, the backend may resume pending AI work for the requested game.
- The snapshot shape is intentionally broad and mirrors the state the frontend consumes.

### `GET /api/events`

- Server-Sent Events endpoint for game snapshots.
- Response content type is `text/event-stream`.
- Sends one snapshot immediately after the stream opens, then pushes later snapshots for the same game.
- The stream is read-only. AI recovery happens on state/open reads, not because a client is subscribed.

### `POST /api/action`

Cookie-authenticated mutation endpoint for active-turn actions.

Common fields:

- `playerId`: required
- `type`: required
- `gameId`: optional when the active game is already selected
- `expectedVersion`: optional but recommended for optimistic concurrency

Supported action types:

- `reinforce`: requires `territoryId`; accepts optional `amount`
- `attack`: requires `fromId`, `toId`; accepts optional `attackDice`
- `attackBanzai`: same request shape as `attack`
- `moveAfterConquest`: requires `armies`
- `fortify`: requires `fromId`, `toId`, `armies`
- `endTurn`: no extra fields
- `surrender`: no extra fields

Success responses return:

```json
{
  "ok": true,
  "state": {},
  "rounds": []
}
```

`rounds` is present only for attack variants.

### `POST /api/join`

- Cookie-authenticated join for a human player.
- Request body must resolve to a valid `gameId`.
- Returns `200` for a rejoin and `201` for a new join.
- Success payload includes `playerId`, `state`, and `user`.

### `POST /api/ai/join`

- Adds an AI player to a lobby.
- Expects `gameId` and `name`.
- Returns `200` for a rejoin and `201` for a new AI slot.
- Success payload includes `playerId`, `state`, and the created `player`.

### `POST /api/start`

- Cookie-authenticated lobby mutation.
- Expects `gameId` and `playerId`.
- The authenticated user must be allowed to start the game and must own the supplied player slot.
- Success payload is `{ "ok": true, "state": { ... } }`.

### `POST /api/cards/trade`

- Cookie-authenticated reinforcement-phase mutation.
- Expects `gameId`, `playerId`, `cardIds`, and optional `expectedVersion`.
- On success returns:

```json
{
  "ok": true,
  "bonus": 0,
  "validation": {},
  "state": {}
}
```

- On version conflict returns the standard `409` snapshot reload envelope.

## Public JSON endpoints not modeled in OpenAPI yet

### `POST /api/auth/register`

- Request body accepts `username`, `password`, and optional `email`.
- On success the backend returns:

```json
{
  "ok": true,
  "user": {},
  "nextAuthProviders": ["password", "email", "google", "discord"]
}
```

- This route is public, but it is not yet backed by a shared runtime response schema, so it is documented here instead of in `docs/openapi.json`.

### `GET /api/health`

- Returns a lightweight backend snapshot:

```json
{
  "ok": true,
  "storage": {},
  "activeGameId": "optional-id",
  "activeGameVersion": 1,
  "hasActiveGame": true
}
```

- The route answers with `200` when `ok` is true and `503` otherwise.

## Internal endpoints excluded from public docs

`/api/test/reset` and `/api/test/next-attack-rolls` exist only for E2E support when `E2E=true`. They are intentionally excluded from the public API reference.
