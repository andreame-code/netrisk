# NetRisk

NetRisk is a minimalist browser-based experiment modeling a Risk-like multiplayer game. It is organized into small modules for deterministic game logic, Supabase-powered networking, UI helpers, and local persistence. The frontend can run entirely on GitHub Pages while real-time data is stored in Supabase tables.

## Project Structure

- `data/` – localStorage persistence helpers.
- `game/` – deterministic game state and mutations.
- `net/` – Supabase networking utilities for lobby management.
- `ui/` – browser UI helpers.
- `docs/` – in-depth guides and references.
- `tests/` – unit tests mirroring the module layout.

## Development

1. Install dependencies: `npm install`.
2. Run linter: `npm run lint`.
3. Check formatting: `npm run format:check`.
4. Execute tests: `npm test`.

See the documentation in `docs/` for more details on specific modules and contribution guidelines.
