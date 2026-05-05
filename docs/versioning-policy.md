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
