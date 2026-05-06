# Changelog

NetRisk uses the application version from `shared/version-manifest.cts` as the release source of truth. Every merge to `main` must include a new app version and a changelog entry for that version.

## 0.1.003 - 2026-05-06

- Refined the game screen bottom command dock so attack, reinforcement, and fortify controls stay inside the reference-style frame on short desktop viewports.
- Restricted module static file serving to declared public asset directories so module manifests and server entrypoints are not exposed.

## 0.1.002 - 2026-05-06

- Implemented rate limiting on the registration endpoint to prevent automated account creation and username enumeration.

## 0.1.001 - 2026-05-05

- Added the release gate that requires every merge to bump the central app version.
- Documented NetRisk's long patch version format and release report expectations.
- Added CI coverage for changelog/report presence before changes reach `main`.
