# NetRisk

NetRisk is a turn-based strategy game inspired by Risk/Risiko, built to grow incrementally without mixing interface concerns, backend orchestration, and pure game rules.

This repository is not just a simple graphical demo: it is a full application foundation for building an extensible version of NetRisk with lobby, profiles, AI, turn flow, combat, cards, and automated tests.

In code and technical documentation, the project remains identified as `NetRisk`. In the current web UI, the visible title is `Frontline Dominion`, with `NetRisk` kept as the brand label.

## Current status

Today the project includes:

- user registration, login, logout, and profile
- initial lobby and reopening saved games
- creation of a new game with supported map and selectable dice ruleset
- joining with human players and adding AI bots
- 2 to 4 player setup with mandatory first human slot
- game start and initial territory assignment
- turn split into phases: `reinforcement`, `attack`, `fortify`, `finished`
- reinforcement placement, attack, conquest, post-conquest movement, and fortification
- attack dice count selection within allowed limits
- territory card assignment at end of turn if at least one conquest occurred during that turn
- card trade during reinforcement with progressive bonus
- mandatory trade above hand-size threshold from the standard ruleset
- player elimination and victory detection
- UI panel for the latest combat dice result
- profile page with games played, wins, losses, ongoing games, and win rate
- events and state synchronization from server to frontend

Currently supported maps are `classic-mini`, `middle-earth`, and `world-classic`.

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

For local development without Supabase, you can also omit `.env.local`: in that case the backend uses the local SQLite datastore by default.

Start server:

```bash
npm start
```

Application available at `http://localhost:3000`.

## Datastore configuration

The project supports two main modes:

- `sqlite`: default local fallback for fast development, with file at `data/netrisk.sqlite`
- `supabase`: remote datastore enabled when `DATASTORE_DRIVER=supabase` or when `SUPABASE_*` variables are present

The example configuration in `.env.example` is intended for a Supabase/Vercel environment. Locally, if you do not want to depend on external services, you can leave `.env.local` absent or set explicitly:

```bash
DATASTORE_DRIVER=sqlite
PORT=3000
```

## Useful commands

```bash
npm start
npm run backup:data
npm run backup:check -- --file data/backups/netrisk-YYYYMMDD-HHMMSS.sqlite
npm run vercel:env:check
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
- `npm run vercel:env:check`: checks parity between required deploy variables and expected configuration
- `npm run test:gameplay`: game engine validation
- `npm run test:e2e`: Playwright tests for user flows
- `npm run test:e2e:update`: intentionally updates Playwright visual baselines
- `npm run test:all`: repository + gameplay tests
- `npm run test:all:e2e`: repository + gameplay + e2e tests

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
- multi-module regression flows

The `e2e` suite currently covers:

- application load
- main layout
- auth navigation between pages
- profile states: loading, error, empty state
- new game setup
- main gameplay flows
- attack dice selection and combat result display
- card panel, successful trade, inline errors, and reward synchronization
- visual baselines for main screen and secondary pages

## Architecture

The architecture follows a simple principle: frontend renders and sends actions, backend decides what is valid, shared modules define the common domain.

- `frontend/public`
  Static web interface: main screens, lobby, new game, profile, game page, style, and client-side logic.
  This is the only frontend source served by the server; root `public/` is not part of runtime.
- `backend`
  HTTP server, authentication, authorization, game session persistence, new game configuration.
- `backend/engine`
  Pure game rules: setup, reinforcement, attack validation, combat dice, conquest, cards, fortify, victory, AI.
- `shared`
  Shared models, primitives, and rulesets across application layers.
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
- `getCardRuleSet`
- `validateStandardCardSet`

Game state notably contains:

- global game phase
- current turn phase
- player list
- territory state
- continents and bonuses
- active player index
- reinforcement pool
- optional winner
- action log
- optional pending conquest
- active dice ruleset
- card deck, discard pile, and player hands
- number of completed trades
- conquest flag in turn for card assignment

## Pages and interface

Main frontend screens currently available:

- `index.html`: application entry
- `lobby.html`: player join and lobby management
- `new-game.html`: new game setup
- `game.html`: active game
- `profile.html`: user profile
- `register.html`: new account creation

The UI is designed to stay thin: it displays state received from the server and sends actions via API.

From a naming perspective, frontend pages currently display title `Frontline Dominion`, while the technical project domain continues to use `NetRisk`.

The game screen also includes:

- attack dice selector with default coherent to selected territory
- latest combat summary panel with dice and comparison
- current player card panel with set selection and trade submission
