# Gameplay Tests

This suite covers backend engine behavior and game rules, separately from Playwright E2E tests.

## Command

`npm run test:gameplay`

## Structure

- `helpers`: builders and deterministic random utilities
- `setup`: game initialization
- `turn-flow`: phase and turn transitions
- `reinforcement`: reinforcement calculation and placement
- `combat`: attack validation and dice resolution
- `conquest`: conquest and army transfer
- `fortify`: fortification movement
- `victory`: elimination and victory
- `regression`: representative multi-module flows
