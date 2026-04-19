# NetRisk

NetRisk is a turn-based strategy game inspired by Risk/Risiko, built to grow incrementally without mixing interface concerns, backend orchestration, and pure game rules.

This repository is not just a simple graphical demo: it is a full application foundation for building an extensible version of NetRisk with lobby, profiles, AI, turn flow, combat, cards, and automated tests.

In code and technical documentation, the project remains identified as `NetRisk`. In the current web UI, the visible title is `Frontline Dominion`, with `NetRisk` kept as the brand label.

## Current status

Today the project includes:

- user registration, login, logout, and profile
- shared runtime validation for auth/profile payloads at backend and frontend boundaries
- typed frontend API client helpers for the migrated `profile` and `lobby` flows
- parallel React + Vite smoke shell served at `/react/`, isolated from the legacy pages
- TanStack Query + Zustand conventions in the React shell, with a minimal `/react/profile` pilot
- initial lobby and reopening saved games
- creation of a new game with supported map, selectable dice ruleset, and configurable turn time limit
- joining with human players and adding AI bots
- 2 to 4 player setup with mandatory first human slot
- game start and initial territory assignment
- turn split into phases: `reinforcement`, `attack`, `fortify`, `finished`
- reinforcement placement, attack, conquest, post-conquest movement, and fortification
- attack dice count selection within allowed limits
- territory card assignment at end of turn if at least one conquest occurred during that turn
- card trade during reinforcement with progressive bonus
- mandatory trade above hand-size threshold from the standard ruleset
- optional `defense-three-dice` ruleset in game setup
- player elimination and victory detection
- surrender flow for active games
- UI panel for the latest combat dice result
- profile page with games played, wins, losses, ongoing games, and win rate
- events and state synchronization from server to frontend
- route-level authorization checks for game pages and actions
- optimistic concurrency handling for game version conflicts
- modular runtime catalog with enable/disable flows, content packs, presets, and server-side module defaults

Currently supported maps are `classic-mini`, `middle-earth`, and `world-classic`.

## Documentation

- [OpenAPI reference](docs/openapi.json)
- [API transport notes](docs/api.md)
- [Gameplay flows](docs/gameplay-flows.md)
- [Extending NetRisk](docs/extending-netrisk.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture background](ARCHITECTURE.md)

## Quick Start

Prerequisites:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Optional local environment setup:

```powershell
Copy-Item .env.example .env.local
```

```bash
cp .env.example .env.local
```

For local development without Supabase, you can also omit `.env.local`: in that case the backend uses the local SQLite datastore by default.

Start server:

```bash
npm start
```

Application available at `http://localhost:3000`.
After `npm start`, the legacy pages are served from the same server, and the React smoke shell is also available at `http://localhost:3000/react/`.

React shell preview:

```bash
npm run dev:react-shell
```

The parallel React + Vite shell is reachable at `http://localhost:5173/react/` in development and at `/react/` from the main server after `npm run build:ts`.
The Vite dev server proxies `/api` to `VITE_BACKEND_TARGET`, which defaults to `http://127.0.0.1:3000`.
Within the React shell, TanStack Query now owns server state for the migrated profile pilot, while Zustand is limited to local shell/session state.

## Datastore configuration

The project supports two main modes:

- `sqlite`: default local fallback for fast development, with file at `data/netrisk.sqlite`
- `supabase`: remote datastore enabled when `DATASTORE_DRIVER=supabase` or when `SUPABASE_*` variables are present

The example configuration in `.env.example` is intended for a Supabase/Vercel environment. Locally, if you do not want to depend on external services, you can leave `.env.local` absent or set explicitly:

```bash
DATASTORE_DRIVER=sqlite
PORT=3000
```

## Scheduled jobs

Production deployments on Vercel execute scheduled checks through `vercel.json`:

- path: `/api/cron/scheduled-jobs`
- schedule: daily (`0 0 * * *`)

The endpoint is protected with `Authorization: Bearer ${CRON_SECRET}` and is intended for Vercel Cron invocations.
Missing `CRON_SECRET` does not block the rest of the application from booting, but it does disable the cron endpoint until the secret is configured.
The current scheduled jobs enforce configured turn time limits for active games and recover stuck AI turns. They are structured so additional jobs can be added under the same scheduler entrypoint.
When an AI recovery is intercepted server-side, the backend also emits a structured `ai_turn_recovery` log event so recovery frequency can be monitored from runtime logs.

## Vercel deployment notes

Preview and production deployments build through:

```bash
npm run build:ts
```

That build emits the legacy static site and the React shell together under `public/`, which is also the configured Vercel output directory.

Required deploy/runtime variables are:

- `AUTH_ENCRYPTION_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATASTORE_DRIVER`

For scheduled jobs, `CRON_SECRET` is required as well.

Before a Vercel deploy, you can validate environment coverage with:

```bash
npm run vercel:env:check
```

That check verifies:

- required production env presence
- required preview env presence for the current branch
- parity between production env keys and the effective preview key set
- cron secret presence for both production and preview

The preview check accepts both globally-scoped preview variables and branch-specific preview overrides, matching the effective configuration used by Vercel deploys.

Repository uploads are also filtered by `.vercelignore` so local artifacts such as temporary logs, coverage output, SQLite files, and generated local junk do not pollute preview builds.

## Useful commands

```bash
npm start
npm run backup:data
npm run backup:check -- --file data/backups/netrisk-YYYYMMDD-HHMMSS.sqlite
npm run build:react-shell
npm run check:ts-sources
npm run coverage
npm run dev:react-shell
npm run vercel:env:check
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
npm run typecheck:frontend
npm run typecheck:react-shell
npm test
npm run test:gameplay
npm run test:e2e
npm run test:e2e:update
npm run test:all
npm run test:all:e2e
```

- `npm test`: standard repository suite
- `npm run backup:data`: creates a consistent SQLite snapshot in `data/backups/`
- `npm run backup:check -- --file ...`: verifies that a SQLite backup is readable and complete
- `npm run build:react-shell`: builds only the parallel React shell into `public/react`
- `npm run check:ts-sources`: enforces the TS-complete allowlist for tracked repository sources
- `npm run coverage`: collects repository + gameplay coverage and writes reports
- `npm run vercel:env:check`: checks parity between required deploy variables and expected configuration
- `npm run dev:react-shell`: starts the parallel React + Vite shell with `/api` proxied to the Node backend
- `npm run lint`: runs the warning-first ESLint baseline for repository TypeScript sources
- `npm run lint:fix`: applies safe auto-fixes from the current ESLint baseline
- `npm run format`: formats the scoped repository sources and docs with Prettier
- `npm run format:check`: verifies the scoped repository sources and docs match the Prettier baseline
- `npm run typecheck`: type-checks the backend/shared/frontend TypeScript graph
- `npm run typecheck:frontend`: type-checks the legacy frontend sources
- `npm run typecheck:react-shell`: type-checks the parallel React shell
- `npm run test:gameplay`: game engine validation
- `npm run test:e2e`: Playwright tests for user flows
- `npm run test:e2e:update`: intentionally updates Playwright visual baselines after an approved UI change
- `npm run test:all`: repository + gameplay tests
- `npm run test:all:e2e`: repository + gameplay + e2e tests

## Code quality

ESLint and Prettier are configured as a TypeScript-first quality baseline for `backend`, `frontend`,
`shared`, `scripts`, `tests`, `api`, and `supabase`.

- `npm run lint` is intentionally warning-first for noisy legacy areas and fails only on higher-value
  correctness issues.
- `npm run format:check` is enforced in CI to keep formatting drift out of follow-up migration work.
- `npm run build:ts` is part of the quality gate, so documentation, generated static output, and the
  React shell all stay aligned with the same build path used in deployment.
- `npm run check:ts-sources` protects the TypeScript migration by rejecting newly tracked non-TS source
  files outside the explicit allowlist.
- `npm run lint:fix` and `npm run format` are safe local helpers before opening a PR.
- GitHub Actions now includes a dedicated `quality` workflow for `lint` and `format:check`, separate from
  coverage and other validation jobs.

## Testing

The `tests/gameplay` suite currently covers areas such as:

- game setup
- turn flow
- reinforcements
- attack validation, dice, and combat resolution
- conquest
- fortify
- victory and elimination
- card helpers and trade bonus
- shared runtime validation schemas and deterministic validation errors
- multi-module regression flows
- repository guardrails such as the TS-complete allowlist for tracked sources

The `e2e` suite currently covers:

- application load
- main layout
- auth navigation between pages
- profile states: loading, error, empty state
- profile invalid payload fallback with controlled UI feedback
- React shell smoke loading on `/react/` with controlled fallback rendering
- new game setup
- main gameplay flows
- attack dice selection and combat result display
- card panel, successful trade, inline errors, and reward synchronization
- granular rendering checks that keep stable gameplay panels mounted during updates
- visual baselines for the main battlefield, mobile lobby shell, and World Classic board layouts

The E2E runner starts an isolated local server, chooses a free port if the default one is unavailable, and uses a temporary SQLite database per run.
For a full local gate before pushing, use `npm run test:all:e2e`.

## Architecture

The architecture follows a simple principle: frontend renders and sends actions, backend decides what is valid, shared modules define the common domain.

- `public`
  Static web interface output generated from the frontend sources and served by the runtime.
- `frontend/react-shell`
  Parallel React + Vite shell used for incremental migration and typed frontend experiments without replacing the legacy UI.
- `frontend/src`
  TypeScript frontend sources for pages, shell, i18n, typed API client helpers, and generated shared imports.
- `modules`
  Runtime-discoverable NetRisk modules that can extend setup defaults, content, presets, and UI slots.
- `backend`
  HTTP server, authentication, authorization, game session persistence, new game configuration.
- `backend/engine`
  Pure game rules: setup, reinforcement, attack validation, combat dice, conquest, cards, fortify, victory, AI.
- `shared`
  Shared models, primitives, rulesets, API contracts, and runtime validation schemas across application layers.
- `tests/gameplay`
  Tests focused on game engine logic.
- `e2e`
  Playwright tests for main user flows.
- `scripts`
  Local execution and test scripts.

For a shorter technical overview focused on code structure, see `ARCHITECTURE.md`.

## Game flow

A typical game follows this path:

1. User creates or opens a game.
2. Human players join the lobby and AI bots can be added optionally.
3. Backend starts the game, distributes territories, and initializes the current turn.
4. Active player enters reinforcement phase and can also trade 3 valid cards for extra reinforcements.
5. Player places reinforcements on owned territories.
6. Player can launch valid attacks against adjacent enemy territories, choosing allowed attack dice.
7. If a territory is conquered, armies must be moved from attacker territory to conquered territory.
8. If at least one territory was conquered during the turn, one card is awarded at end of turn if available.
9. Turn enters fortify phase.
10. Turn ends and backend computes the next active player.
11. When only one player with territories remains, game closes with winner.

## Shared models

The shared constructs exposed by `shared/models.cjs` are:

- `TurnPhase`
- `GameAction`
- `CardType`
- `STANDARD_DICE_RULE_SET_ID`
- `STANDARD_CARD_RULE_SET_ID`
- `createPlayer`
- `createTerritory`
- `createContinent`
- `createGameState`
- `createCard`
- `createStandardDeck`
- `getDiceRuleSet`
- `listDiceRuleSets`
- `getCombatRuleSet`
- `listCombatRuleSets`
- `getReinforcementRuleSet`
- `listReinforcementRuleSets`
- `getFortifyRuleSet`
- `listFortifyRuleSets`
- `getCardRuleSet`
- `validateStandardCardSet`
- `getVictoryRuleSet`
- `listVictoryRuleSets`
- `listSiteThemes`
- `listPlayerPieceSets`
- `listContentPacks`
- `listContentModules`

For runtime contract validation shared by backend and frontend, see `shared/runtime-validation.cts`.
For the current framework-agnostic frontend transport boundary used by the migrated `profile` and `lobby` flows, see `frontend/src/core/api/`.

Game state notably contains:

- global game phase
- current turn phase
- player list
- territory state
- continents and bonuses
- active player index
- reinforcement pool
- optional winner
- active victory ruleset
- active fortify ruleset
- active player piece set
- action log
- optional pending conquest
- active dice ruleset
- card deck, discard pile, and player hands
- number of completed trades
- conquest flag in turn for card assignment

## Pages and interface

Main frontend screens currently available:

- `index.html`: application entry
- `landing.html`: public landing page
- `lobby.html`: player join and lobby management
- `new-game.html`: new game setup
- `game.html`: active game
- `profile.html`: user profile
- `register.html`: new account creation
- `/react/`: parallel React + Vite smoke shell

The UI is designed to stay thin: it displays state received from the server and sends actions via API.
For the migrated `profile` and `lobby` pages, raw network details now live in the typed frontend client layer under `frontend/src/core/api/`, so page modules stay focused on rendering and UI state.
The React shell follows the same rule: it reuses the shared typed client and does not duplicate game rules locally.
For the current React pilot, TanStack Query is used only for remote profile state and mutations, while Zustand is reserved for shell-local session state and UI ownership.

From a naming perspective, frontend pages currently display title `Frontline Dominion`, while the technical project domain continues to use `NetRisk`.

The game screen also includes:

- attack dice selector with default coherent to selected territory
- latest combat summary panel with dice and comparison
- current player card panel with set selection and trade submission

## License

This project is released under the [MIT License](./LICENSE).
