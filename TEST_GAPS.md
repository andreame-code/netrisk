# Test Gaps

## Covered
- Backend gameplay rules and regression flows
- Core E2E gameplay flows: reinforcement, attack/conquest, fortify handoff, turn guard, version conflict
- AI autoplay E2E
- Authorization E2E: non-member denied on protected game open and direct game route read
- Lobby/Game/Profile header and auth cross-page layout coverage
- New game setup happy path
- New game setup negative validation: invalid map selection shows in-page error
- Player profile E2E: error without session
- Main battlefield visual baseline

## Missing
- Player profile E2E: loading, empty
- Admin policy coverage
- Visual regression expansion: Lobby, New Game, Profile

## Next Recommended Gap
- Player profile E2E: empty state

