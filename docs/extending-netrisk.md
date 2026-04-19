# Extending NetRisk

NetRisk supports two extension paths:

- built-in extensions under `shared` for core maps, registries, and engine-integrated rule families
- runtime modules under `modules` for additive content, presets, UI slots, and optional server-side content packages

Choose the built-in path when the feature becomes part of the main product baseline. Choose a runtime module when the feature should stay optional, discoverable, and enable/disable-friendly.

## Path 1: built-in maps and rule registries

Use this path for core content that should always ship with the base game.

### Adding a built-in map

1. Add typed territory and continent records under `shared/maps/data`.
2. Add the exported map module under `shared/maps`.
3. Register it in `shared/maps/index.cts`.
4. Keep topology and validation inside shared utilities such as `shared/map-graph.cts`, `shared/map-loader.cts`, and `shared/typed-map-data.cts`.
5. Cover the new map with shared and gameplay tests.

The current built-in map registry is resolved through `shared/maps/index.cts`, which is the single source of truth for supported maps.

### Adding a built-in rule family or rule variant

Rule ids should remain stable and backend-resolved.

1. Add the rule definition to the owning shared registry, for example:
   - `shared/combat-rule-sets.cts`
   - `shared/reinforcement-rule-sets.cts`
   - `shared/fortify-rule-sets.cts`
   - `shared/victory-rule-sets.cts`
   - `shared/dice.cts`
2. Make sure setup and extension selection continue to store rule ids instead of duplicated rule logic. The current selection flow is centered on `shared/extensions.cts`.
3. Apply the rule in the matching engine module under `backend/engine`.
4. Update validation and defaults only where the transport or configuration shape changes.
5. Add focused gameplay tests.

Good examples already in the repository:

- dice rule selection flowing through `shared/dice.cts`, `shared/extensions.cts`, and `backend/new-game-config.cts`
- victory rule selection resolved in `shared/victory-rule-sets.cts` and enforced in `backend/engine/victory-detection.cts`

## Path 2: runtime modules

Runtime modules are loaded from `modules` and validated by the backend runtime catalog.

Use this path for:

- optional maps or content packs
- selectable presets and profiles
- UI slot contributions
- runtime piece sets, dice rule sets, or server-side gameplay defaults

### Required files

Every module starts with `module.json`. Client-visible contributions live in `client-manifest.json`. Add a server entrypoint only when the module contributes server-side content or defaults.

Minimal structure:

```text
modules/<module-id>/
  module.json
  client-manifest.json
  server-module.cts   # optional
  assets/             # optional
```

### `module.json`

Use `module.json` to declare:

- stable `id`, `version`, and `engineVersion`
- `kind` (`content`, `gameplay`, `ui`, or `hybrid`)
- dependencies and conflicts
- capabilities
- entrypoints and optional assets directory

The existing `modules/demo.command-center/module.json` is the best reference for a valid hybrid module manifest.

### `client-manifest.json`

Use the client manifest for declarations the backend can expose without running custom code:

- `ui.slots`
- `gamePresets`
- `profiles.content`
- `profiles.gameplay`
- `profiles.ui`
- client-visible `content` capability ids

The demo module shows all three patterns:

- slot contributions for lobby, new game, game sidebar, and admin modules
- a game preset that activates the module and picks profiles
- named profiles for content, gameplay, and UI

### Optional server entrypoint

Add a server entrypoint when the module contributes runtime content or defaults that the backend must resolve directly. The current runtime supports:

- `maps`
- `contentPacks`
- `playerPieceSets`
- `diceRuleSets`
- server-side `profiles`

The regression coverage in `tests/gameplay/regression/module-runtime.test.cts` contains concrete fixtures for runtime maps, content packs, piece sets, dice rule sets, and server-side default profiles.

### Runtime module checklist

1. Declare the module and its capabilities in `module.json`.
2. Add `client-manifest.json` for presets, slots, and profiles.
3. Add a server entrypoint only when backend-resolved content is needed.
4. Enable the module through the modules API or admin tooling.
5. Verify that `GET /api/modules/options` and `GET /api/game/options` expose the expected catalog changes.
6. Add regression coverage for enable/disable behavior and selection rules.

## Built-in vs runtime: which one should you pick?

Use built-in extensions when:

- the feature is part of the default NetRisk product
- it must always be available
- the engine should depend on it directly

Use runtime modules when:

- the feature is optional or experimental
- you want enable/disable support
- you need presets, profiles, or UI slot packaging
- you want to ship content without rewriting the base registries

## Guardrails

- Keep game rules in `backend/engine`, not in React components.
- Keep shared ids and transport contracts in `shared`.
- Avoid duplicating validation in both frontend and backend.
- Prefer additive modules and registries over broad refactors.
- Back every new map, rule, or module path with focused tests.
