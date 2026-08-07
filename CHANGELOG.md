# Changelog

NetRisk uses the application version from `shared/version-manifest.cts` as the release source of truth. Every merge to `main` must include a new app version and a changelog entry for that version.

## 0.1.065 - 2026-08-07

- Added fail-closed mobile UAT on real Android/Chromium and iPhone/WebKit device profiles, including three portrait sizes and one landscape viewport.
- Covered landing, keyboard-safe authentication, protected routes, empty/waiting/full lobbies, authenticated setup, complete gameplay phases, 44 px touch targets, full-map fit, one-finger pan, and native two-finger pinch.
- Pinned the mobile CI job to the Playwright 1.61.1 Noble image and retained browser reports, traces, screenshots, and video when a mobile scenario fails.

## 0.1.064 - 2026-08-07

- Limited both command and War Table lobby views to 15 initial games with an accessible load-more action, full-dataset search and filters, and active/waiting-first ordering.
- Kept focused campaigns resolvable beyond the visible page and added mobile coverage with more than 70 sessions at 390 by 844 pixels.
- Hid known automated fixture prefixes from the production lobby and added daily cleanup for fixture sessions older than 24 hours.

## 0.1.063 - 2026-08-07

- Redirected anonymous profile and game-setup routes to login before protected content or data requests are loaded.
- Preserved canonical and `/react` destinations, query parameters, and locale across authentication.
- Distinguished expired session cookies from first-time anonymous access, cleared stale cookies, and added a localized login notice.

## 0.1.062 - 2026-08-06

- Replaced the anonymous mobile quick-login form with one compact login action that preserves the requested destination.
- Removed duplicate header credentials from the dedicated login route at every viewport size while retaining desktop quick login elsewhere.
- Kept the mobile app header within two 44 px action rows across supported phone widths and added functional browser coverage for form counts, focus visibility, and touch targets.

## 0.1.061 - 2026-08-06

- Added fit-to-view zoom for horizontally cropped mobile maps so the complete board can be displayed on screen.
- Added native two-pointer pinch-to-zoom while preserving one-pointer panning, mouse wheel zoom, and the existing zoom controls.
- Added unit and mobile browser regressions for minimum-scale calculation, full-board visibility, and pinch gesture behavior.

## 0.1.060 - 2026-08-06

- Replaced stale-lobby phase mutation with atomic deletion guarded by game ID, version, and update timestamp so concurrent activity is never removed.
- Added an exact maintenance candidate report with the configured age threshold and immediate post-cleanup revalidation.
- Added per-lobby removed, skipped, and failed results to the admin UI and persistent maintenance audit trail.
- Added SQLite, Supabase, API, and React regressions for stale, recent, active, finished, concurrent-change, and deletion-failure cases.
- Advanced the additive admin maintenance API contract to 1.2.0 and the admin-console, datastore, and public-state module versions.

## 0.1.059 - 2026-08-06

- Added a guarded admin preview and repair flow for finished games with orphaned runtime module and profile references while preserving valid gameplay state and selections.
- Added explicit game-ID confirmation, fail-closed validation, and success/failure audit evidence for configuration repairs.
- Prevented development-only demo, test, and fixture module IDs from being enabled or persisted in Vercel preview and production deployments.
- Advanced the central API compatibility version to 1.1.0 for the additive required admin repair-preview response fields.
- Added atomic app-state compare-and-set persistence and advanced the datastore schema to version 2 so concurrent Vercel instances cannot overwrite newer admin configuration or module catalog changes during cleanup migrations.
- Recorded minor functional versions for the changed module runtime, public-state contract, and datastore concurrency surface.

## 0.1.058 - 2026-08-05

- Localized login and registration metadata and content across Italian, English, German, and Spanish on canonical and React alias routes.
- Removed internal registration copy, translated Italian shell navigation, and corrected Italian landing and authentication diacritics.
- Prevented unauthenticated admin redirects from leaving stale admin titles and added route/locale regression coverage.

## 0.1.057 - 2026-08-05

- Split the direct landing and authenticated React shell entries and deferred the optional Sentry integration until after the initial render.
- Moved landing styles into a route-owned CSS chunk and kept shared game-shell styles behind the lazy authenticated shell boundary, reducing initial transfers without changing route layouts.
- Added documented, route-aware initial JavaScript/CSS budgets that fail the production build and CI with a clear regression report.

## 0.1.056 - 2026-08-05

- Pinned Playwright 1.61.1, Chromium 149.0.7827.55 (revision 1228), Ubuntu 24.04, and the Linux font dependencies used by visual baselines.
- Added a visual-test environment preflight that reports and rejects browser, operating-system, or font drift before snapshot assertions run.
- Added a reproducible visual-regression CI/container workflow while retaining Playwright expected, actual, and diff artifacts on failures.

## 0.1.055 - 2026-08-05

- Replaced unauthenticated lobby open/join requests with explicit login links that preserve the selected game destination.
- Prevented valid public lobby sessions from surfacing the misleading `Sessione non valida.` error to signed-out visitors.
- Added React and browser regression coverage for the guest active-game flow.

## 0.1.054 - 2026-08-05

- Made Vercel-to-GitHub deployment registration resilient to missing, expired, or unauthorized API tokens by falling back to the successful Vercel status URL.
- Preserved Production versus Preview classification during token-free deployment registration.
- Added a visible GitHub Actions warning when Vercel environment parity cannot be audited, plus regression coverage for both workflows.

## 0.1.053 - 2026-08-05

- Added selectable easy, medium, and hard difficulty for each AI player, with legacy AI slots defaulting to medium.
- Expanded AI decisions with difficulty-specific risk tolerance, continent completion and opponent-blocking pressure, proactive hard-mode card trades, and stronger conquest/fortification choices.
- Persisted per-AI balancing metrics for turns, reinforcements, attacks, conquests, card trades, and fortifications, and exposed them through validated game snapshots.
- Added gameplay, configuration, transport-validation, and React setup tests for AI difficulty and metrics.

## 0.1.052 - 2026-08-05

- Added map authoring to the admin Content Studio with persisted drafts, structured territory and continent editing, live validation, and publish/disable lifecycle controls.
- Integrated published authored maps into runtime game options and game creation while preserving existing victory-objective modules and blocking unsafe map disable operations when referenced.
- Added regression coverage for map topology validation, API persistence, UI authoring, runtime catalog exposure, and game creation.

## 0.1.051 - 2026-08-05

- Hardened sensitive game state transitions (starting a game and trading cards) with rate limiting to mitigate spam and automated abuse.
- Centralized rate-limiting error handling with a reusable helper to ensure consistent responses and standardized security headers.

## 0.1.050 - 2026-06-07

- Hardened input validation schemas with maximum string length constraints for identifiers, names, and configuration IDs to mitigate Denial of Service (DoS) risks and resource exhaustion.

## 0.1.049 - 2026-06-06

- Hardened API request parsing by enforcing strict `Content-Type: application/json` for mutation requests (POST, PUT, PATCH).
- Improved global request error handling to support dynamic status codes and localized error keys from rejected promises.

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
