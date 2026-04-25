# Test Gaps

## Covered

- Card system: long-game card awarding reshuffles discard back into deck
- Visual regression expansion: Lobby, New Game, Profile
- Admin policy coverage
- Player profile E2E: loading
- Card system: enforce mandatory trade above hand limit
- Card system: trade valid sets for reinforcements
- Card system: traded cards now move into the discard pile
- Card system API: trade endpoint
- Card system public state: forced trade metadata
- Card system API: authenticated player hand visibility
- Card system UI: minimal trade panel on game page
- Card system UI: player hand refreshes after game actions
- Card system UI: inline trade error feedback
- Card system UI: inline trade success feedback
- Card system: award one card on turn end after at least one conquest
- Card system foundation: standard rule set, deck storage, player hands metadata
- Backend gameplay rules and regression flows
- Code quality baseline: ESLint warning-first rollout, Prettier enforcement, and dedicated CI quality workflow
- Core E2E gameplay flows: reinforcement, attack/conquest, fortify handoff, turn guard, version conflict
- React gameplay E2E: deep link, join/start, forced trade, and version-conflict recovery
- Frontend gameplay API client: typed state/start/action/trade helpers, SSE payload parsing, and version-conflict extraction
- AI autoplay E2E
- Authorization E2E: non-member denied on protected game open and direct game route read
- Authorization E2E: creator can reopen a protected lobby from a direct game route
- Backend API: unknown `gameId` returns `GAME_NOT_FOUND` without killing the server
- Lobby/Game/Profile header and auth cross-page layout coverage
- New game setup happy path
- New game setup negative validation: invalid map selection shows in-page error
- Player profile E2E: error without session
- Main battlefield visual baseline
- Mobile lobby visual baseline
- World Classic board visual baselines across desktop, laptop, and tablet viewports
- Attack UI: selected dice count is sent to the backend
- Vercel build pipeline: preview/prod build command compila TypeScript prima della sync asset
- Shared runtime validation: auth/profile schemas, route validation failures, and controlled frontend fallback
- Gameplay E2E: granular rendering reinforcement flow stabilized against async control population
- React shell routes: bootstrap, auth redirects, lobby/profile/new game, and gameplay route rendering
- TS-complete allowlist regression: React shell sources are allowed and tracked stray `.js` sources are rejected
- Codex PR readiness automation smoke coverage via temporary dummy PR

## Missing

- None currently tracked

## Next Recommended Gap

- None currently tracked
