# Extending NetRisk

NetRisk now resolves setup, admin, and client-visible module data through one additive catalog model:

```text
core.base baseline + enabled runtime modules -> backend/module-runtime.cts -> resolvedCatalog
```

`core.base` is the baseline provider for the default modular platform. It is always enabled and should not be treated as a toggleable optional module. Optional modules under `modules/` extend that baseline. The backend exposes the result through:

- `GET /api/modules/options` for the full admin-facing module snapshot
- `GET /api/game/options` for the setup-facing public snapshot

Both endpoints now include an additive `resolvedCatalog` field. New consumers should treat `resolvedCatalog` as the canonical source of truth. The flat top-level arrays (`maps`, `ruleSets`, `themes`, and so on) remain available as backward-compatible mirrors derived from that catalog.

NetRisk supports three authoring paths:

- shared baseline content under `shared` when the feature becomes part of the default product
- optional runtime modules under `modules` when the feature should stay discoverable, enable/disable-friendly, and packageable for admins
- constrained admin-authored content through Content Studio when the feature can be represented as validated data

Choose the shared baseline path when the feature should ship with `core.base`. Choose a runtime module when the feature should remain optional or be rolled out incrementally.
Choose Content Studio when admins should author validated gameplay content without editing files or executing arbitrary module code.

## Path 1: built-in maps and rule registries

Use this path for core content that should always ship with the default `core.base` experience.

### Adding a built-in map

1. Add typed territory and continent records under `shared/maps/data`.
2. Add the exported map module under `shared/maps`.
3. Register it in `shared/maps/index.cts`.
4. Keep topology and validation inside shared utilities such as `shared/map-graph.cts`, `shared/map-loader.cts`, and `shared/typed-map-data.cts`.
5. If the map should be part of the default setup catalog, expose it through `shared/core-base-catalog.cts`.
6. Cover the new map with shared and gameplay tests.

The typed map definitions still live under `shared/maps/*`, but the baseline setup catalog now flows through `shared/core-base-catalog.cts`.

### Adding a built-in rule family or rule variant

Rule ids should remain stable and backend-resolved.

1. Add the rule definition to the owning shared registry, for example:
   - `shared/combat-rule-sets.cts`
   - `shared/reinforcement-rule-sets.cts`
   - `shared/fortify-rule-sets.cts`
   - `shared/victory-rule-sets.cts`
   - `shared/dice.cts`
2. Make sure setup and extension selection continue to store rule ids instead of duplicated rule logic. The current selection flow is centered on `shared/extensions.cts`.
3. If the rule variant should be selectable in the baseline setup catalog, expose the summarized baseline entry through `shared/core-base-catalog.cts`.
4. Apply the rule in the matching engine module under `backend/engine`.
5. Update validation and defaults only where the transport or configuration shape changes.
6. Add focused gameplay tests.

Good examples already in the repository:

- dice rule selection flowing through `shared/dice.cts`, `shared/extensions.cts`, and `backend/new-game-config.cts`
- victory rule selection resolved in `shared/victory-rule-sets.cts` and enforced in `backend/engine/victory-detection.cts`

## Path 2: runtime modules

Runtime modules are loaded from `modules`, validated by the backend runtime, and merged with the `core.base` baseline into `resolvedCatalog`.

Use this path for:

- optional maps or content packs
- selectable presets and profiles
- UI slot contributions
- runtime piece sets, dice rule sets, card rule set summaries, or server-side gameplay defaults

### What admins get from modules

For admins, enabling a module can now change all of these surfaces without patching route handlers or React consumers:

- available maps, content packs, piece sets, dice rule sets, victory rule sets, themes, and piece skins
- game presets
- content, gameplay, and UI profiles
- supported UI slot contributions

Those changes become visible through `/api/modules/options` and `/api/game/options`, and the selected modular setup stays persisted when a game is created, reopened, summarized, or shown in profile/admin views.

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

Supported `slotId` values are currently:

- `admin-modules-page`
- `game.sidebar`
- `lobby.page`
- `new-game.sidebar`
- `top-nav-bar`

### Optional server entrypoint

Add a server entrypoint when the module contributes runtime content or defaults that the backend must resolve directly. The current runtime supports:

- `maps`
- `contentPacks`
- `playerPieceSets`
- `diceRuleSets`
- `cardRuleSets`
- server-side `profiles`

Server-side profiles can also contribute setup defaults, `gameplayEffects`, and `scenarioSetup`, which are then persisted in `gameConfig` and preserved across create/open/save round trips.

The regression coverage in `tests/gameplay/regression/module-runtime.test.cts` contains concrete fixtures for runtime maps, content packs, piece sets, dice rule sets, card rule set summaries, and server-side default profiles.

## Modular cards

The default card module is defined in `shared/cards.cts` as `standardCardModuleManifest` and exposed through `standardCardRuleSet`. It preserves the existing infantry, cavalry, artillery, and wild cards, the same territory-card deck generation, the same valid trade sets, the same trade bonus sequence, and the same forced-trade threshold.

Card instances in saved game state remain small and backward-compatible: `id`, `type`, `territoryId`, and optional `definitionId`. Names, descriptions, visual tokens, play conditions, and effect metadata come from card definitions and are added to public snapshots at the backend boundary.

To add a core card:

1. Add or update the card definition in `standardCardModuleManifest` or a new manifest in `shared/cards.cts`.
2. Give the definition a stable `id`, `displayName`, `description`, `category`, `visual`, `effect`, and optional localization keys.
3. Configure graphics with `visual.token` and `visual.tone`; the React shell maps `tone` to existing `game-card-tone-*` CSS and displays `token` inside the card tile.
4. Attach only a registered effect handler. The current core effect is `tradeForReinforcements`, implemented in `backend/engine/card-effects.cts`.
5. Add or update validation and gameplay tests in `tests/gameplay/shared/cards.test.cts`.

Validation is centralized in `validateCardModuleManifest` / `assertValidCardModuleManifest`. It rejects duplicate card ids, missing names/descriptions, unknown effect handlers, invalid visual metadata, invalid territory references when a map context is supplied, malformed module compatibility metadata, unknown play conditions, and unsafe non-serializable data. Do not store executable JavaScript in manifests.

Runtime modules may expose `cardRuleSets` summaries for catalog discovery and content-pack references. Full runtime card behavior is still constrained to known engine handlers; adding a new rule effect requires registering a backend handler and tests, not loading code from JSON.

### Runtime module checklist

1. Declare the module and its capabilities in `module.json`.
2. Add `client-manifest.json` for presets, slots, and profiles.
3. Add a server entrypoint only when backend-resolved content is needed.
4. Enable the module through the modules API or admin tooling.
5. Verify that `GET /api/modules/options` and `GET /api/game/options` expose the expected `resolvedCatalog` changes.
6. Verify that admin summaries and reopened games still show the expected active modules, preset/profile ids, and modular setup metadata.
7. Add regression coverage for enable/disable behavior, selection rules, and persistence-sensitive setup data.

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

Use Content Studio when:

- the authored content fits a supported schema such as `victory-objectives`
- admins need draft/validate/publish/enable/disable flows
- generated runtime data can be persisted into `gameConfig`
- the engine can consume that resolved payload directly

## Guardrails

- Keep game rules in `backend/engine`, not in React components.
- Keep shared ids and transport contracts in `shared`.
- Avoid duplicating validation in both frontend and backend.
- Prefer `resolvedCatalog` in new consumers and keep flat option fields only for compatibility bridges.
- Prefer additive modules and registries over broad refactors.
- Back every new map, rule, or module path with focused tests.
- Keep Content Studio authoring schema-driven and server-validated; do not turn it into an arbitrary code upload path.
