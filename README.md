# NetRisk

Base architecture for a turn-based strategy game inspired by Risk, organized to keep UI, server state, and shared rules clearly separated.

## Structure

- `frontend/public`: game UI, map rendering, panels, auth and turn controls
- `backend`: HTTP API, sessions, orchestration, persistence entrypoints
- `backend/engine`: pure game rules and turn logic
- `shared`: shared models, enums, and DTO-style structures reused across layers
- `scripts`: local tooling and automated tests
- `data`: local runtime files such as registered users

## Core Models

Shared models already defined in `shared/models.cjs`:

- `Player`
- `Territory`
- `Continent`
- `GameState`
- `GameAction`
- `TurnPhase`

## Local Start

```bash
npm start
```

Then open `http://localhost:3000`.

## Test Commands

```bash
npm test
npm run test:gameplay
npm run test:all
npm run test:all:e2e
```

- `npm test`: existing repository test suite
- `npm run test:gameplay`: backend engine gameplay rules
- `npm run test:all`: repository suite + gameplay suite
- `npm run test:all:e2e`: repository suite + gameplay suite + Playwright E2E

## Notes

- The frontend only renders state and sends actions.
- The backend remains the source of truth for the match.
- Pure game rules live in `backend/engine`.
- The structure is ready to evolve toward both single player and turn-based multiplayer.
- The pre-commit hook runs both `npm test` and `npm run test:gameplay`.
