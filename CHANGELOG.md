# Changelog

NetRisk uses the application version from `shared/version-manifest.cts` as the release source of truth. Every merge to `main` must include a new app version and a changelog entry for that version.

## 0.1.049 - 2026-06-07

- Hardened API request parsing by enforcing strict `Content-Type: application/json` for all mutation requests (POST, PUT, PATCH).
- Improved server-side error reporting to properly propagate client-side status codes and message keys, preventing valid client errors from being masked as internal server errors.

## 0.1.048 - 2026-06-06

- Added branch-focused engine coverage for turn timeout expiration and combat resolution edge cases.

## 0.1.047 - 2026-06-05

- Added rate limiting for game creation and joining requests to mitigate automated lobby creation and spam.

## 0.1.046 - 2026-06-05

- Added Linux Playwright visual baselines and stabilized E2E card trade and attack dice assertions for local CI-style runs.

## 0.1.045 - 2026-06-05

- Updated the npm dependency group for React, Vite, Vitest, ESLint, Sentry, Supabase CLI, and related type/runtime packages.

## 0.1.044 - 2026-06-05

- Added branch-focused auth store coverage for legacy session migration, cleanup, validation, and public profile projection.

## 0.1.043 - 2026-06-05

- Added bounded admin authored-module request validation while preserving legacy authored-module storage compatibility.

## 0.1.042 - 2026-06-05

- Added rate limiting for AI lobby join requests to reduce automated lobby filling and resource exhaustion.

## 0.1.041 - 2026-06-05

- Added focused victory objective assignment coverage and made generated validation sync skip unchanged files.

## 0.1.040 - 2026-06-05

- Refined the mobile gameplay shell reference states for collapsed, half-open, expanded, and drawer-based command actions.

## 0.1.039 - 2026-06-05

- Modularized the card system with validated card definitions, rendering metadata, and a registered reinforcement trade effect.

## 0.1.038 - 2026-06-05

- Polished the mandatory card trade dock with a larger bottom-panel layout, clearer card selection states, and focused forced-trade interaction.

## 0.1.037 - 2026-06-05

- Moved frontend module catalog helpers onto generated runtime validation transport types.

## 0.1.036 - 2026-06-05

- Extracted module runtime catalog projection into a focused helper with direct coverage.

## 0.1.035 - 2026-06-05

- Extracted React gameplay view-state derivation into a focused helper with unit coverage.

## 0.1.034 - 2026-06-05

- Consolidated expected-version mutation preflight handling across game action, card trade, and join routes.

## 0.1.033 - 2026-06-05

- Moved live reinforcement placement mutation into the dedicated reinforcement placement engine module.

## 0.1.032 - 2026-05-19

- Hardened password hashing and verification by migrating to asynchronous non-blocking crypto operations.

## 0.1.031 - 2026-05-19

- Hardened auth throttling IP resolution while preserving trusted Vercel forwarded headers.

## 0.1.030 - 2026-05-19

- Added branch-focused coverage for shared content pack/message helpers and local environment file loading.

## 0.1.029 - 2026-05-19

- Added Retry-After headers to rate-limited authentication and account settings responses.

## 0.1.028 - 2026-05-19

- Fixed signed-out game deep links so auth-required game reads offer login and registration paths back to the requested game.

## 0.1.027 - 2026-05-19

- Improved gameplay route regression coverage for invalid outbound game snapshots and SSE client lifecycle handling.

## 0.1.026 - 2026-05-19

- Added branch-focused coverage for fortify movement validation and Supabase connection check edge cases.

## 0.1.025 - 2026-05-15

- Hardened security headers by adding defensive X-Powered-By removal and conditional HSTS based on connection security.
- Added X-Content-Type-Options: nosniff to all JSON and SSE responses to prevent MIME-sniffing.

## 0.1.024 - 2026-05-15

- Added branch-focused coverage for auth throttling edge cases and AI lobby join route behavior.

## 0.1.023 - 2026-05-14

- Added branch-focused coverage for turn timeout enforcement saves, AI recovery persistence, legacy version fallback, and session token storage-key validation.

## 0.1.022 - 2026-05-14

- Prevented AI display names from satisfying human game membership checks for creator-protected games.

## 0.1.021 - 2026-05-14

- Re-authorized SSE broadcasts with the persisted game creator so lobby listeners are dropped before receiving active-game updates they cannot read.

## 0.1.020 - 2026-05-13

- Required authenticated game-read access before returning state or event streams for legacy games without a recorded creator.

## 0.1.019 - 2026-05-13

- Updated the grouped npm runtime, React, testing, and build-tool dependencies.

## 0.1.018 - 2026-05-13

- Hardened the game event stream (SSE) by removing overly permissive CORS headers and enforcing strict anti-caching security policies.

## 0.1.017 - 2026-05-12

- Fixed the mobile mandatory card-trade layout so the map board remains fully visible above the command dock.

## 0.1.016 - 2026-05-11

- Added branch-focused coverage for AI turn resume guards, stale AI handoff, and localized AI failure handling.

## 0.1.015 - 2026-05-11

- Added the mobile map-first gameplay shell with a compact header, floating HUD, bottom-sheet commands, and phone viewport coverage.

## 0.1.014 - 2026-05-11

- Hardened module UI slot routes by rejecting unsafe schemes and external URLs before module links reach the frontend.

## 0.1.013 - 2026-05-11

- Hardened session storage by hashing server-side session tokens and revoking user sessions after password or role changes.

## 0.1.012 - 2026-05-11

- Hardened module metadata and JSON API responses by returning project-relative module paths and disabling API response caching.

## 0.1.011 - 2026-05-11

- Added branch-focused regression tests for map data validation, reinforcement adjustments, and conquest resolution edge cases.

## 0.1.010 - 2026-05-09

- Hardened authentication flow against timing-based username enumeration by ensuring consistent password hashing execution paths for all users.

## 0.1.009 - 2026-05-08

- Added the Supabase CLI as a pinned development dependency and scoped the Supabase MCP config to the NetRisk project.

## 0.1.008 - 2026-05-08

- Hardened Supabase datastore access by requiring the service-role key and enabling RLS guardrails for Supabase-backed tables.

## 0.1.007 - 2026-05-07

- Hardened request handling in the custom HTTP server against malformed Host headers and prioritized security header application.

## 0.1.006 - 2026-05-06

- Added central functional module versioning, compatibility validation, and CI bump protection for module-owned changes.

## 0.1.005 - 2026-05-06

- Updated the npm dependency group for runtime, testing, and lint tooling packages.

## 0.1.004 - 2026-05-06

- Refined the game screen bottom command dock so attack, reinforcement, and fortify controls stay inside the reference-style frame on short desktop viewports.

## 0.1.003 - 2026-05-06

- Restricted module static file serving to declared public asset directories so module manifests and server entrypoints are not exposed.

## 0.1.002 - 2026-05-06

- Implemented rate limiting on the registration endpoint to prevent automated account creation and username enumeration.

## 0.1.001 - 2026-05-05

- Added the release gate that requires every merge to bump the central app version.
- Documented NetRisk's long patch version format and release report expectations.
- Added CI coverage for changelog/report presence before changes reach `main`.
