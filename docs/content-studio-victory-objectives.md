# Content Studio Victory Objectives

This document describes the first authored gameplay-module flow shipped through the admin console.

## Scope

The new `Content Studio` admin area is the first constrained authoring surface for gameplay modules.
In this phase it supports one module type:

- `victory-objectives`

The system is intentionally schema-driven. Admins can author validated objective modules without
editing source files, but they cannot execute arbitrary code or upload scripts.

## Authoring lifecycle

Victory objective modules move through three states:

- `draft`: editable and saveable even when validation errors still exist
- `published`: validated and available in runtime victory-rule catalogs
- `disabled`: previously published content that is hidden from runtime selection

The admin UI supports:

- listing existing authored modules
- starting a new draft
- editing an existing draft
- validating the current draft continuously
- publishing a valid draft
- disabling or re-enabling a published module
- inspecting the generated runtime JSON

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

For `victory-objectives`, `content` currently contains:

- `mapId`
- `objectives[]`

Supported objective types in this phase:

- `control-continents`
- `control-territory-count`

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

Drafts may remain invalid. Publishing and enabling require a clean validation result.

## Runtime integration

Published authored victory modules are merged into the runtime catalog by `backend/module-runtime.cts`.

That means they now appear in:

- `GET /api/game/options`
- admin default selection flows
- runtime victory-rule catalogs used during game creation

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
