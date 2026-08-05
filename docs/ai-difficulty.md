# AI difficulty and balancing metrics

NetRisk stores an optional difficulty on every AI player. The supported values are `easy`, `medium`, and `hard`.

- `easy` requires a larger army advantage before attacking, may skip otherwise valid attacks, moves the minimum after conquest, and fortifies conservatively.
- `medium` preserves the original deterministic NetRisk heuristics and is the fallback for legacy games and requests that omit difficulty.
- `hard` accepts calculated risks, prioritizes completing its own continents and blocking an opponent's continent, trades valid card sets before the forced threshold, and commits more armies after conquest and during fortification.

Difficulty is selected independently for each AI slot in the new-game UI. It is persisted both on the resolved player slot configuration and on the AI player, so a resumed turn keeps the same strategy. The AI-join API also accepts an optional `difficulty`; omitted values resolve to `medium`.

## Metrics

Each started game initializes an `aiMetrics` record in the saved game state. Metrics are grouped by AI player ID and include:

- difficulty;
- completed AI turns;
- reinforcement placements;
- attacks;
- territories conquered;
- card sets traded;
- fortifications.

The record also captures current human and AI player counts. It is included in validated public snapshots, allowing operational or offline balancing tools to aggregate outcomes by difficulty together with the saved game's `winnerId`. No external telemetry or personal data is sent.

The metrics object is additive and optional. Existing save-game schema version 1 records remain compatible; legacy AI players and saves without metrics continue with `medium` difficulty and create metrics on their next AI turn.
