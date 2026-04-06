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

## Preferred structure
- frontend: UI, map rendering, panels, local presentation state
- backend: API, game orchestration, persistence, multiplayer support
- backend/engine: pure game rules and turn logic
- shared: shared types, DTOs, enums, schemas

## Change safety rules
1. Always inspect relevant files before editing.
2. Reuse existing conventions and naming.
3. Do not introduce new dependencies unless necessary.
4. If adding a dependency, explain why it is needed.
5. Do not make cosmetic refactors mixed with feature work.
6. Do not touch unrelated files.
7. When possible, keep one concern per change.

## Git safety workflow
Before large changes, remind the user to create a git checkpoint.
Before heavy code changes requested by the user, automatically create and switch to a new git branch before editing files.
After changes, summarize exactly which files were touched and why.

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
