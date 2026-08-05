# Content Studio Authored Gameplay

This document describes the authored gameplay-module flows shipped through the admin console.

## Scope

The `Content Studio` admin area is a constrained authoring surface for gameplay modules. It
supports two module types:

- `victory-objectives`
- `map`

The system is intentionally schema-driven. Admins can author validated objective modules without
editing source files, but they cannot execute arbitrary code or upload scripts.

## Authoring lifecycle

Victory objective modules move through three states:

- `draft`: editable and saveable even when validation errors still exist
- `published`: validated and available in runtime victory-rule catalogs
- `disabled`: previously published content that is hidden from runtime selection

The admin UI supports both module types through the same lifecycle:

- listing existing authored modules
- starting a new draft
- editing an existing draft
- validating the current draft continuously
- publishing a valid draft
- disabling or re-enabling a published module
- inspecting the generated runtime JSON

Map drafts additionally provide structured editors for territories, normalized coordinates,
bidirectional neighbor links, continents, membership, and reinforcement bonuses.

The section is available from the admin console at `/admin/content-studio` and `/react/admin/content-studio`.

Published or disabled modules are read-only in this phase. If later revisioning is needed, the
next step should introduce explicit draft-from-published versioning rather than in-place mutation.

## Data model

Shared transport and validation contracts live in `shared/runtime-validation.cts`.

The authored module shape includes:

- `id`
- `name`
- `description`
- `version`
- `status`
- `moduleType`
- `createdAt`
- `updatedAt`
- `content`

For `victory-objectives`, `content` contains:

- `mapId`
- `objectives[]`

Supported objective types in this phase:

- `control-continents`
- `control-territory-count`

For `map`, `content` contains:

- `territories[]` with stable ids, names, continent assignment, normalized `x`/`y` coordinates,
  and neighbor ids
- `continents[]` with stable ids, names, whole-number reinforcement bonuses, and territory ids

The authored map module id is also its runtime map id.

## Persistence

Authored modules are persisted through the existing datastore app-state mechanism under the
`authoredGameplayModules` key.

That keeps the feature aligned with current NetRisk persistence patterns:

- no hardcoded gameplay content in source files
- no manual file editing by admins
- no new persistence stack introduced just for authoring

The service entry point is `backend/authored-modules.cts`.

## Validation rules

Validation happens on the backend and is exposed to the UI for live feedback.

Current rules include:

- required module id, name, description, version, and map
- supported module type only
- objective id uniqueness within a module
- supported objective type only
- valid continent ids for the selected map
- valid territory count bounds for the selected map
- at least one objective
- at least one enabled objective before publish

Map validation additionally requires:

- at least two territories and one continent
- unique, portable ids for territories and continents
- coordinates between `0` and `1`
- known, non-duplicated, bidirectional neighbor links
- a single connected map graph
- exactly one consistent continent assignment per territory
- non-negative whole-number continent bonuses

Drafts may remain invalid. Publishing and enabling require a clean validation result.

## Runtime integration

Published authored victory modules and maps are merged into the runtime catalog by
`backend/module-runtime.cts`.

That means they now appear in:

- `GET /api/game/options`
- admin default selection flows
- runtime victory-rule catalogs used during game creation

Published maps additionally appear in the map catalog used by `GET /api/game/options`, admin
defaults, new-game setup, and the game engine. Their validated territory graph, positions,
continents, and bonuses are used directly when a game is created.

## Pluggable rules and bonuses

Authored maps use the same runtime contribution model as installed NetRisk modules rather than a
parallel rules engine. Map continent bonuses are stored in the authored map definition. Broader
custom gameplay rules remain data-driven module contributions, including dice and card rule sets,
reinforcement adjustments, combat/fortify limits, scenario territory bonuses, victory rules, and
setup profiles. The Content Studio can add more constrained editors for those contribution types
without allowing uploaded scripts or arbitrary code execution.

When a game is created with an authored victory module:

- the selected authored module id is stored in `gameConfig.victoryRuleSetId`
- the resolved authored runtime payload is stored in `gameConfig.victoryObjectiveModule`

The engine uses that persisted runtime payload in `backend/engine/victory-detection.cts` to
evaluate authored objectives without needing an admin lookup at turn time.

## Admin API

The admin routes live in `backend/routes/admin-content-studio.cts`.

Current endpoints:

- `GET /api/admin/content-studio/options`
- `GET /api/admin/content-studio/modules`
- `GET /api/admin/content-studio/modules/:id`
- `POST /api/admin/content-studio/modules/validate`
- `POST /api/admin/content-studio/modules`
- `PUT /api/admin/content-studio/modules/:id`
- `POST /api/admin/content-studio/modules/:id/publish`
- `POST /api/admin/content-studio/modules/:id/enable`
- `POST /api/admin/content-studio/modules/:id/disable`

These routes reuse the existing admin authorization and audit flow through `backend/admin-console.cts`.
They are intentionally excluded from the public OpenAPI artifact because they are operator-only workflows, but they still use shared runtime validation schemas.

## UI structure

The React screen is extracted into `frontend/react-shell/src/admin-content-studio.tsx`.

The monolithic admin route only owns:

- navigation
- section selection
- shell framing

The authoring screen owns:

- module list
- draft editor
- objective editor
- live validation
- player-facing preview
- generated runtime JSON
- structured map territory and continent editors

Regression coverage lives in:

- `tests/gameplay/regression/admin-content-studio-routes.test.cts`
- `frontend/react-shell/src/__tests__/admin-route.integration.test.tsx`

## Extension path for future module types

The current model is intentionally narrow but extendable.

The next constrained authoring types should follow the same pattern:

1. add a shared schema and runtime payload
2. add backend validation and persistence rules
3. add an editor surface in Content Studio
4. merge published output into the runtime catalog
5. persist resolved runtime data into `gameConfig` when selected
6. let the engine consume the resolved payload directly

Good next candidates:

- reinforcement modifiers
- alternate combat rule selections
- scenario start bonuses
- map-specific setup constraints
