# NetRisk - Agent Instructions

## Mission

Build and evolve NetRisk as a maintainable turn-based strategy game inspired by Risk/Risiko.
The project must be safe to extend over time without rewriting existing work.

## Core principles

1. Never rewrite entire files unless explicitly requested.
2. Modify only the minimum code needed for the requested change.
3. Never delete existing code unless explicitly requested.
4. Never rename files, folders, exported functions, or public interfaces unless strictly necessary.
5. Preserve the existing project structure.
6. Prefer adding new modules over heavily editing existing ones.
7. Keep changes small, reviewable, and easy to revert.
8. Before coding, always propose a short implementation plan.
9. After the plan, implement only the requested step, not extra future steps.
10. If a request would require broad refactoring, stop and explain the impact before changing code.

## Architecture rules

1. The frontend must only handle rendering, user input, and UI state.
2. The backend is the source of truth for game state and rule validation.
3. Shared models and types must live in the shared area.
4. Game rules must not be duplicated between frontend and backend.
5. Game logic must be organized in dedicated engine modules.

## Language policy

1. The project must evolve toward pure TypeScript.
2. All new code must be written in pure TypeScript.
3. Legacy non-TypeScript code may be kept only where needed for backward compatibility.
4. Do not introduce new non-TypeScript code unless it is strictly required to integrate with legacy parts.

## Preferred structure

- frontend: UI, map rendering, panels, local presentation state
- backend: API, game orchestration, persistence, multiplayer support
- backend/engine: pure game rules and turn logic
- shared: shared types, DTOs, enums, schemas

## API boundary validation

1. All new API boundaries should use shared runtime validation when payloads cross backend/frontend boundaries.
2. Shared request/response schemas must live in `shared` when consumed by both backend and frontend.
3. Frontend code must validate remote payloads at the boundary before UI consumption.
4. Backend routes must validate inbound payloads and critical outbound responses.
5. Validation schemas must define transport shape only and must not duplicate game-rule logic.

## Versioning and compatibility

NetRisk should use a central Version and Compatibility Registry as the source of truth for compatibility-related versions.

1. Do not add version constants in random files.
2. Keep app, engine, API, datastore, save-game, and module API versions centralized.
3. Saved game state changes must consider save-game schema compatibility.
4. Module manifest changes must consider module API compatibility.
5. API response shape changes must consider API versioning and runtime validation.
6. Backward compatibility must be preserved unless the task explicitly says to introduce a breaking change.
7. If a change may break existing saved games or modules, call it out explicitly in the PR summary.
8. Do not create a full migration framework unless explicitly requested.

Expected central files once they exist:

- `shared/version-manifest.cts`
- `shared/compatibility.cts`
- `shared/save-game-migrations.cts`

## Change safety rules

1. Always inspect relevant files before editing.
2. Reuse existing conventions and naming.
3. Do not introduce new dependencies unless necessary.
4. If adding a dependency, explain why it is needed.
5. Do not make cosmetic refactors mixed with feature work.
6. Do not touch unrelated files.
7. When possible, keep one concern per change.

## Git safety workflow

For read-only tasks, reviews, analysis, planning, or other work that does not modify files, do not create a branch, commit changes, push, or open a PR.
For tasks that modify files, create and switch to a dedicated git branch for the chat before editing files, or continue on the existing dedicated branch for that chat.
If the worktree is in detached HEAD and a task requires file changes, create and switch to a branch named `codex/<short-description>` before editing files.
Before large or risky changes, remind the user to create a git checkpoint.
Do not stop after local implementation if the task is an implementation request: once local validation passes, automatically continue with commit, push, and PR creation/update unless the user explicitly says not to.
Do not hesitate about creating or updating a PR when this workflow applies: treat PR creation/update as part of completing the task, not as an optional follow-up.
After changes, summarize exactly which files were touched and why.

## Execution loop and validation gate

For every implementation step, run an explicit loop: modify, run relevant tests, fix, and rerun tests until the step is stable.
Use targeted tests during inner-loop development, then run the full required local validation before updating the PR.
Update or create the PR only when the current step passes local validation.
If local validation passes and the user asked for implementation rather than planning only, proceed immediately to the PR update flow without waiting for an extra confirmation.
After each PR update, explicitly request a Codex review on the PR.
Treat the Codex PR review as an additional validation loop separate from automated tests: Codex comments on the PR, fix the actionable feedback, rerun the necessary tests, push the update, and request Codex review again.
Do not consider the PR step complete until the latest Codex review has no unresolved actionable comments, unless the user explicitly instructs otherwise.
After each PR update, require GitHub CI and Vercel preview/checks to pass.
If any local or remote check fails, analyze the failure, fix the issue, rerun the necessary tests, update the PR again, and repeat until all required checks are green.
Do not mark the task complete while required remote checks are still failing or pending, unless explicitly instructed otherwise.

## Expected workflow for every task

1. Read the current structure.
2. Propose a concise plan.
3. Wait for or follow the requested step scope.
4. Implement only that scope.
5. Summarize modified files.
6. Mention risks or follow-up steps separately.

## Communication style

- Be direct and concise.
- Do not overengineer.
- Do not produce giant rewrites.
- Prefer practical progress over speculative redesign.

## For this project specifically

NetRisk should be built incrementally in this order:

1. architecture and models
2. map and territories
3. turn flow
4. reinforcement rules
5. combat rules
6. movement rules
7. victory conditions
8. AI
9. multiplayer
10. map editor and custom rules

## Important project guardrails

- Do not rebuild the whole app when implementing a single feature.
- Do not move business logic into React components.
- Do not mix transport, persistence, and game rules in one file.
- Do not replace working code just because another design seems cleaner.
- Do not introduce scattered version constants; use the central Version and Compatibility Registry.
- Respect backward compatibility with the current project unless explicitly told otherwise.

## Agent skills

These skill settings only configure how Matt Pocock's skills find issue-tracker, triage-label, and domain-doc information. They do not override the NetRisk agent instructions above. If there is any conflict, the existing NetRisk guardrails, current user request, and repository-specific instructions take precedence.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `andreame-code/netrisk`, inferred from the configured `origin` remote. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default GitHub Issue label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout with root `CONTEXT.md` and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Skill invocation gate

When the user explicitly asks to use Matt Pocock skills, the agent must invoke the requested slash skills explicitly before editing files.

For architecture work, the minimum required sequence is:

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
