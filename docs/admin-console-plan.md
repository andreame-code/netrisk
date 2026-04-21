# Admin Console Execution Plan

## Discovery Summary

- Auth uses cookie-backed sessions via `netrisk_session` and persists `user.role` in the datastore.
- Backend authorization already supports admin-only policies for module management in `backend/authorization.cts`.
- The React shell lives under `frontend/react-shell` and already hides some admin-only module controls behind `user.role === "admin"`.
- Game sessions are persisted in the shared datastore and normalized through `backend/game-session-store.cts`.
- New game configuration and runtime/module resolution flow through `backend/new-game-config.cts`, `backend/module-runtime.cts`, and `shared/extensions.cts`.
- Runtime ID preservation is already a known risk area, especially for custom runtime dice rules and maps preserved by `migrateGameConfigExtensions`.

## Delivery Slices

1. Add shared admin transport schemas and backend admin route plumbing.
2. Add admin authorization helpers and audit logging for admin mutations.
3. Implement admin overview, users, games, config, runtime/modules, maintenance, and audit APIs.
4. Build a real React admin shell with guarded navigation and confirmed mutations.
5. Add regression tests for route/API protection, user role mutation, game maintenance actions, and config/runtime preservation.
6. Document local admin setup, leave a final handoff summary, and complete the git/PR loop.

## Guardrails For This Change

- Reuse the existing role model instead of inventing a second permission system.
- Keep the backend as the source of truth for every admin mutation.
- Reuse shared runtime validation for every new admin request/response boundary.
- Preserve runtime-resolved IDs when validating and normalizing admin-managed config.
- Require explicit confirmation for destructive or repair-style actions.
- Keep the first admin console small but operational, with real data and real mutation paths.
