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

## Change safety rules

1. Always inspect relevant files before editing.
2. Reuse existing conventions and naming.
3. Do not introduce new dependencies unless necessary.
4. If adding a dependency, explain why it is needed.
5. Do not make cosmetic refactors mixed with feature work.
6. Do not touch unrelated files.
7. When possible, keep one concern per change.

## Git safety workflow

For every new chat, automatically create and switch to a dedicated git branch before making changes.
Each chat must always continue on its own dedicated branch, even when switching between different chats.
Before large changes, remind the user to create a git checkpoint.
Before heavy code changes requested by the user, automatically create and switch to a new git branch before editing files.
Do not stop after local implementation if the task is an implementation request: once local validation passes, automatically continue with commit, push, and PR creation/update unless the user explicitly says not to.
Do not hesitate about creating or updating a PR when this workflow applies: treat PR creation/update as part of completing the task, not as an optional follow-up.
After changes, summarize exactly which files were touched and why.

## Execution loop and validation gate

For every implementation step, run an explicit loop: modify, run relevant tests, fix, and rerun tests until the step is stable.
Use targeted tests during inner-loop development, then run the full required local validation before updating the PR.
Update or create the PR only when the current step passes local validation.
If local validation passes and the user asked for implementation rather than planning only, proceed immediately to the PR update flow without waiting for an extra confirmation.
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
- Respect backward compatibility with the current project unless explicitly told otherwise.
