# Versioning Policy

NetRisk application releases use the central `appVersion` in `shared/version-manifest.cts`.

## Format

Application versions use a long patch segment:

```text
MAJOR.MINOR.PATCH
0.1.001
```

The patch segment must contain at least three digits. Routine changes should usually increment the patch segment by one. Larger feature sets may increment the minor version and reset the patch segment to `000`. Breaking changes may increment the major version and reset minor and patch to `0.000`.

`package.json` keeps standard npm metadata. Do not use it as the NetRisk application release source of truth because npm SemVer does not allow padded numeric identifiers such as `0.1.001`.

## Merge Requirements

Every PR that targets `main` must include:

- an increased `appVersion` in `shared/version-manifest.cts`
- a matching `CHANGELOG.md` section
- at least one bullet under that changelog section describing the user-visible or operational change

If a change affects save games, API responses, datastore shape, module manifests, or module compatibility, update the corresponding central compatibility fields in `shared/version-manifest.cts` and call the compatibility impact out in the changelog entry.

The release gate runs in CI and fails when the version does not move forward or the changelog report is missing.

## Functional Module Versions

Functional module versions live in `shared/module-versions.cts`.

A functional module is a maintained game capability or platform surface that can affect setup,
runtime behavior, saved state compatibility, admin workflows, or public contracts. The current
registry is derived from the existing codebase and includes runtime packages such as `core.base`
and `demo.command-center`, content catalogs such as `maps`, `content-packs`, `site-themes`,
`player-piece-sets`, and `piece-skins`, rule families such as `dice-rule-sets`,
`card-rule-sets`, `combat-rule-sets`, `reinforcement-rule-sets`, `fortify-rule-sets`, and
`victory-rule-sets`, plus platform/admin surfaces such as `setup-flow`, `module-runtime`,
`authored-victory-objectives`, `admin-console`, `datastore`, `public-state`, `turn-timeouts`,
and `ai-players`.

Each entry defines:

- `id`: stable module id used by compatibility declarations
- `version`: SemVer-style `MAJOR.MINOR.PATCH`
- `ownerPaths`: repo paths used by the first-pass version bump detector
- `description` and `kind`: human-readable context for contributors, Codex, CI, and future admin UI

Runtime modules still keep their `module.json` version because module discovery needs package-local
metadata. For first-party runtime modules, `scripts/check-module-versioning.cts` verifies that
`module.json` matches the central version in `shared/module-versions.cts`.

## Module Bump Rules

Use standard SemVer for functional module versions:

- PATCH: internal fixes that do not change public behavior, transport shape, saved-state compatibility, or module interoperability.
- MINOR: backward-compatible feature additions, optional module behavior extensions, or additive admin/UI capabilities.
- MAJOR: breaking behavior changes, saved-state incompatibility, public API/schema changes, required migrations, or compatibility changes that older consumers cannot use safely.

If a change touches a module-owned path, bump that module in `shared/module-versions.cts`. If one
change touches multiple module-owned paths, bump each affected module according to its impact.

## Module Compatibility

Compatibility declarations also live in `shared/module-versions.cts`. They are machine-readable and
cover:

- compatible app/site version range
- compatible save-game schema range
- compatible datastore schema range
- compatible module API range
- required dependent modules and accepted version ranges

Use `checkModuleCompatibility(moduleId, version, environment)` to answer whether a module version
is compatible with an app/save/datastore/module environment. Use `isModuleCompatibleWith(...)` for
the common pair question: "is module X version A compatible with module Y version C?"

`validateModuleVersionManifest()` and `scripts/check-module-versioning.cts` reject missing module
compatibility declarations, invalid SemVer values, malformed or impossible ranges, and references
to modules that do not exist.

## Bump Detection Limitations

The bump detector is intentionally practical rather than magical. It maps changed files to
`ownerPaths` in `shared/module-versions.cts` and compares module versions with the configured git
base ref. This catches normal code and content changes, but shared files that affect several
capabilities may require manual judgement and multiple bumps. When in doubt, bump the module whose
public behavior, saved state, admin workflow, or compatibility surface changed.
