# Test Gaps

## Covered
- Backend gameplay rules and regression flows
- Core E2E gameplay flows: reinforcement, attack/conquest, fortify handoff, turn guard, version conflict
- AI autoplay E2E
- Authorization E2E: non-member denied on protected game open
- Lobby/Game/Profile header and auth cross-page layout coverage
- New game setup happy path
- New game setup negative validation: invalid map selection shows in-page error
- Main battlefield visual baseline

## Missing
- Authorization E2E: non-member denied on protected game read/direct game route
- Player profile E2E: loading, empty, error without session
- Admin policy coverage
- Visual regression expansion: Lobby, New Game, Profile

## Next Recommended Gap
- Player profile E2E: error without session
