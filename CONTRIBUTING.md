# Contributing to NetRisk

NetRisk grows best through small, well-bounded changes. Keep frontend rendering concerns, backend orchestration, and pure engine rules separate so new features stay easy to review and extend.

## Local setup

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

For local work without Supabase, you can omit `.env.local` or set:

```bash
DATASTORE_DRIVER=sqlite
PORT=3000
```

Useful local commands:

```bash
npm start
npm run dev:react-shell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:gameplay
npm run test:e2e:smoke
```

## Change boundaries

- `frontend` and `frontend/react-shell`: rendering, navigation, UI state, and client transport helpers
- `backend`: HTTP routing, auth, persistence, orchestration, and module/runtime integration
- `backend/engine`: pure turn logic and rules
- `shared`: contracts, runtime validation, registries, map data, and shared domain types
- `modules`: runtime-discoverable extensions, presets, UI slots, and optional server-side content

Keep game rules out of React components and out of route handlers. The backend is the source of truth for state transitions.

## Working style

- Prefer small, reviewable commits and PRs.
- Modify the minimum code required for the change.
- Do not mix cosmetic refactors with feature work.
- Reuse existing ids, registries, and validation helpers instead of introducing parallel patterns.
- For setup/module option consumers, prefer the frontend catalog helpers in `frontend/src/core/module-catalog.mts`, and keep any contract change aligned with `shared/api-contracts.cts` plus `shared/runtime-validation.cts`.
- Keep new code in TypeScript.

## Validation expectations

Run the smallest relevant validation set for your change, then broaden when the edit crosses boundaries.

- Documentation-only changes: `npm run format:check`
- Shared types, routes, or engine logic: `npm run typecheck` and `npm test`
- Turn rules, setup rules, or combat/reinforcement changes: `npm run test:gameplay`
- UI, routing, or end-to-end behavior changes: `npm run test:e2e:smoke` or the most relevant Playwright subset

If you change public API payloads or shared validation, verify the implementation against `shared/runtime-validation.cts` and `shared/api-contracts.cts`.

## Adding maps

Built-in maps live in `shared`, not in the frontend.

1. Add typed territory and continent data under `shared/maps/data`.
2. Add the map module under `shared/maps`.
3. Register it in `shared/maps/index.cts`.
4. Keep map-specific validation and topology inside shared helpers such as `shared/map-graph.cts` and `shared/map-loader.cts`.
5. If the map should be part of the default product catalog, expose it through `shared/core-base-catalog.cts`.
6. Cover the new map with gameplay and shared tests instead of UI-only checks.

Do not hardcode map rules or adjacency in the browser.

## Adding rules

Rules should be selected by stable ids and resolved on the backend.

1. Add or extend the shared registry that owns the rule family, such as dice, victory, reinforcement, or fortify rule sets.
2. Persist only ids and metadata needed by the game config.
3. If the rule should be selectable in the default baseline setup, surface its summary through `shared/core-base-catalog.cts`.
4. Apply the rule in the appropriate engine module under `backend/engine`.
5. Keep request/response validation separate from rule evaluation.
6. Add focused tests under `tests/gameplay`.

If a rule changes setup defaults or extension selection, update the shared extension/module selection flow rather than duplicating conditionals in the UI.

## Adding runtime modules

Runtime modules are the right choice for additive content, presets, UI slots, or optional gameplay packaging.

Default product content belongs in shared registries plus `shared/core-base-catalog.cts`. Use `modules/` for additive packaging that should stay optional.

1. Create a folder under `modules/<module-id>`.
2. Add `module.json` with id, version, capabilities, dependencies, and entrypoints. Optional runtime modules should normally depend on `core.base`.
3. Add `client-manifest.json` for UI slots, profiles, presets, and client-visible content declarations.
4. Add a server entrypoint only when the module contributes runtime maps, content packs, piece sets, dice rule sets, or server-side profile defaults.
5. Verify the module through `/api/modules/options` and `/api/game/options`, treating `resolvedCatalog` as the canonical snapshot and the flat top-level arrays as compatibility mirrors.
6. Verify rescan/enable/disable flows, including the case where a module is still referenced by an active game.
7. Confirm the module does not expose `core.base` as a toggleable setup/admin option.
8. Add or extend regression coverage in `tests/gameplay/regression/module-runtime.test.cts`.

Use the existing `modules/demo.command-center` fixture as the baseline shape for manifests and slot declarations.

## API and validation guardrails

- Shared request and response schemas belong in `shared` when both backend and frontend consume them.
- Validate inbound route payloads and important outbound responses.
- Treat opaque game snapshots as server-owned data structures.
- Keep OpenAPI and Markdown API docs aligned with the code whenever a public route changes.
- If you touch `/api/modules/options` or `/api/game/options`, document both the canonical `resolvedCatalog` behavior and any compatibility mirrors you keep.
- If you touch module manifests or catalog resolution, also verify `/api/modules`, `/api/modules/options`, `/api/game/options`, plus admin rescan/enable/disable behavior.

## Pull requests

A good PR for NetRisk is narrow, tested, and explicit about touched boundaries.

- Summarize what changed and why.
- List any public API or docs updates.
- Mention the validation commands you ran.
- Call out follow-up work separately instead of folding it into the same change.
