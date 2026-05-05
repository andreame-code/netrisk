# NetRisk - Agent Instructions

## Mission

Build and evolve NetRisk as a maintainable turn-based strategy game inspired by Risk/Risiko.

The project must remain safe to extend over time, especially as more work is done with AI agents. Prefer small, reviewable, reversible changes over broad rewrites.

## Operating mode

For every task:

1. Inspect the relevant files before editing.
2. State a concise implementation plan unless the task is trivial.
3. Change only what is needed for the requested scope.
4. Run the most relevant validation available.
5. Summarize changed files and why they changed.
6. Clearly list remaining risks, skipped checks, or follow-up work.

Do not expand the task beyond what the user asked for unless required to complete it correctly.

If the request is ambiguous, destructive, security-sensitive, or requires a broad architectural change, stop and ask for clarification or explain the trade-off before editing.

## Core principles

1. Do not rewrite entire files unless explicitly requested or clearly safer than patching.
2. Do not rebuild working systems just because a cleaner design exists.
3. Preserve existing behavior unless the requested change requires otherwise.
4. Keep one concern per change whenever possible.
5. Prefer adding small modules over heavily mutating large files.
6. Do not mix cosmetic refactors with feature work.
7. Do not touch unrelated files.
8. Avoid new dependencies unless they materially reduce risk or complexity.
9. If adding a dependency, explain why it is needed and where it is used.
10. Delete code only when it is obsolete, duplicated, unsafe, or directly replaced by the change; explain the deletion.
11. Do not rename files, folders, exported functions, or public interfaces unless the requested change requires it.
12. Keep changes easy to review, revert, and test.

## Architecture rules

1. The backend is the source of truth for game state and rule validation.
2. The frontend handles rendering, user input, local UI state, and presentation only.
3. Game rules must not be duplicated between frontend and backend.
4. Shared models, DTOs, enums, and schemas must live in the shared area when consumed by both sides.
5. Game logic must live in dedicated engine modules, not inside React components or route handlers.
6. Keep transport, persistence, and game rules separated.
7. Backend APIs must validate inbound payloads and critical outbound responses.
8. Frontend code must validate remote payloads at the boundary before UI consumption.
9. Validation schemas describe transport shape only; they must not duplicate game-rule logic.
10. Backward compatibility must be preserved unless the user explicitly asks for a breaking change.

## Language policy

1. NetRisk should evolve toward pure TypeScript.
2. New application code must be TypeScript.
3. Legacy JavaScript may remain when needed for compatibility or when converting it would create unnecessary risk.
4. Do not introduce new non-TypeScript application code unless there is a clear compatibility reason.
5. Config files, scripts, and tooling files may follow the conventions already used in the repository.

## Preferred structure

Use the existing repository structure as the source of truth. In general:

- `frontend`: UI, map rendering, panels, local presentation state.
- `backend`: API, game orchestration, persistence, multiplayer support.
- `backend/engine`: pure game rules, turn logic, combat, reinforcement, movement, victory checks.
- `shared`: shared types, DTOs, enums, schemas, runtime validation.

Do not move files or rename exports unless the requested change requires it.

## Versioning and compatibility

Use the central Version and Compatibility Registry as the source of truth for compatibility-related versions.

1. Do not add version constants in random files.
2. Keep app, engine, API, datastore, save-game, and module API versions centralized.
3. Use `shared/version-manifest.cts` and `shared/compatibility.cts` for existing compatibility decisions.
4. Create or extend `shared/save-game-migrations.cts` only when a save-game compatibility change actually requires it.
5. Saved game state changes must consider save-game schema compatibility.
6. Module manifest changes must consider module API compatibility.
7. API response shape changes must consider API versioning and runtime validation.
8. If a change may break existing saved games, APIs, or modules, call it out explicitly in the PR summary.
9. Do not create a broad migration framework unless explicitly requested.

## Game-specific guardrails

1. Preserve the current map behavior unless the user explicitly asks to change it.
2. For game-screen UI work, keep the experience map-centric.
3. Menus, panels, dialogs, cards, and action states should visually match the current game direction.
4. Do not hide critical game state behind decorative UI.
5. Reinforcement, attack, fortification, cards, objectives, and victory logic must be testable outside the UI.
6. AI behavior must use the same rules engine as human players.
7. Multiplayer and persistence must not bypass backend validation.
8. Admin-configurable rules must not create invalid game states.
9. Do not move business logic into React components.
10. Do not mix transport, persistence, and game rules in one file.

## UI and design rules

1. Preserve existing layout intent unless the task is specifically a redesign.
2. When given screenshots or mockups, treat them as visual constraints.
3. Match spacing, density, hierarchy, and interaction style from the provided references.
4. Do not change the map when the task only asks for menus, panels, modals, or action states.
5. Keep labels accurate: if a tab or section represents cards, do not call it map.
6. Prefer incremental UI polish over complete component replacement.
7. Avoid introducing a new visual language in only one part of the app.

## AI-assisted change safety

AI-generated or AI-assisted code must meet the same standards as handwritten code.

1. Prefer small patches with clear intent over large generated rewrites.
2. Inspect generated code for duplicated rules, hidden state, broad abstractions, and untested branches.
3. Do not accept generated code that bypasses engine boundaries, validation, or compatibility rules.
4. Add or update tests when generated code changes behavior.
5. Keep domain terminology aligned with `CONTEXT.md` and ADRs when they exist.
6. If generated code changes architecture, document the reason in the PR summary or an ADR when appropriate.

## Testing and validation

Before editing, inspect `package.json`, workflow files, and existing tests to identify the correct commands.

Use targeted checks during development, then run broader validation before completion when available. Prefer one extra relevant test over an under-validated change.

Typical validation priorities:

1. Type checks and builds required by the repo scripts.
2. Unit tests for changed game logic.
3. React tests for changed UI behavior.
4. Integration tests for API, validation, persistence, or module changes.
5. E2E tests for game flow, routing, or important UI interactions.
6. Lint and formatting checks.

Common local commands include:

- `npm run typecheck`
- `npm run typecheck:frontend`
- `npm run typecheck:react-shell`
- `npm run build:ts`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run test:gameplay`
- `npm run test:react`
- `npm run test:e2e:smoke`
- `npm run test:all`
- `npm run test:all:e2e`

Choose the smallest validation set that proves the change during development, then broaden before push or PR. For risky changes, prefer `npm run test:all` or `npm run test:all:e2e` when the environment can support it.

If a command is unavailable, failing for unrelated reasons, or too expensive for the environment, say so clearly and run the next best validation.

Never claim tests passed unless they were actually run and passed.

## Git workflow

If working in a writable git repository:

1. Check the current branch before editing.
2. For implementation tasks that modify files, create or use a dedicated branch for the chat.
3. If the worktree is in detached HEAD and the task modifies files, create and switch to `codex/<short-description>` before editing.
4. Do not create unnecessary branches for pure review, planning, explanation, or documentation-only analysis.
5. Commit only coherent, validated changes.
6. Do not commit secrets, generated junk, local environment files, or unrelated formatting changes.
7. Before large or risky changes, create a checkpoint commit or ask the user to confirm the approach.

If GitHub remote access is available and the user asked for implementation:

1. Push the branch after local validation passes, unless the user explicitly says not to.
2. Create or update a PR when appropriate for the workflow.
3. Include a clear PR summary, validation performed, and known risks.
4. Do not mark work complete while required local validation is failing.

If GitHub access is not available:

1. Provide the patch summary.
2. List exact commands the user should run.
3. State that push or PR creation was not performed.

## CI, Vercel, and PR review

When a PR exists and remote checks are available:

1. Check GitHub CI and Vercel preview status if possible.
2. If checks fail, inspect the failure and fix actionable issues.
3. Re-run relevant local validation before pushing fixes.
4. Do not pretend remote checks are green if they are pending, unavailable, or not checked.

Requesting Codex review on a PR is useful only when the environment supports it. Do not block forever waiting for a self-review loop. If Codex review comments are available, fix actionable comments, rerun validation, and update the PR.

## Definition of done

A task is complete only when:

1. The requested scope has been implemented or clearly explained.
2. Relevant files were inspected.
3. Relevant validation was run, or unavailable validation was explicitly disclosed.
4. Changed files are summarized.
5. Risks and follow-ups are listed separately.
6. No unrelated changes were introduced.

## Development order for NetRisk

Prefer incremental development in this order unless the user asks otherwise:

1. Architecture and shared models.
2. Map and territories.
3. Turn flow.
4. Reinforcement rules.
5. Combat rules.
6. Movement and fortification rules.
7. Cards and objectives.
8. Victory conditions.
9. AI.
10. Multiplayer.
11. Map editor.
12. Custom rules and admin configuration.

## Stop conditions

Stop and ask or report before proceeding if:

1. The task requires deleting or rewriting large parts of the app.
2. The change affects persistence, migrations, saved games, or module compatibility.
3. The change introduces authentication, authorization, or security impact.
4. The change requires new production dependencies.
5. The tests reveal unrelated failures that cannot be safely fixed in scope.
6. The requested implementation conflicts with existing architecture.

## Communication style

- Be direct and concise.
- Prefer practical progress over speculative redesign.
- Explain trade-offs when there is more than one reasonable path.
- Do not overengineer.
- Do not produce giant rewrites unless explicitly requested.
- Do not hide uncertainty.

## Agent skills

These skill settings only configure how Matt Pocock's skills find issue-tracker, triage-label, and domain-doc information. They do not override the NetRisk guardrails, current user request, or repository-specific instructions above.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `andreame-code/netrisk`, inferred from the configured `origin` remote. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default GitHub Issue label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout with root `CONTEXT.md` and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Skill invocation gate

When the user explicitly asks to use Matt Pocock skills, the agent must invoke the requested slash skills explicitly before editing files.

For architecture work that explicitly requests the skill-driven workflow, the minimum required sequence is:

1. `/zoom-out`
2. `/improve-codebase-architecture`
3. `/grill-with-docs`
4. `/tdd` before implementation
5. `/diagnose` if validation fails for unclear reasons

The agent must provide visible evidence sections for every requested skill:

- Skill evidence: `/zoom-out`
- Skill evidence: `/improve-codebase-architecture`
- Skill evidence: `/grill-with-docs`
- Skill evidence: `/tdd`
- Skill evidence: `/diagnose`, if used

If a requested slash skill is unavailable, stop and say:

“Requested skill unavailable: /<skill-name>”

Do not silently simulate a skill.
Do not continue with ordinary implementation when the user asked for a skill-driven workflow.
