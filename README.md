# NetRisk

Base architecture for a turn-based strategy game inspired by Risk, organized to keep UI, server state, and shared rules clearly separated.

## Structure

- `frontend/public`: game UI, map rendering, panels, auth and turn controls
- `backend`: HTTP API, sessions, game state orchestration, validations, future multiplayer and AI hooks
- `shared`: common models, rules, enums, and game state structures reused across layers
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

## Notes

- The frontend only renders state and sends actions.
- The backend remains the source of truth for the match.
- The structure is ready to evolve toward both single player and turn-based multiplayer.
- Use `npm test` before commits; the repository hook runs it automatically.
