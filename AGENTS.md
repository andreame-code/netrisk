# Repository Guidelines

This file is the canonical reference for repository-specific instructions. All contributors should read it before making changes.

## Development workflow
- Break large efforts into self-contained tickets with clearly defined scope and interface contracts. Document the pre- and post-conditions for any new or updated API.
- Assess the impact of touching existing code by mapping dependencies, inputs/outputs, and previously covered edge cases before you start editing.
- Keep all project documentation, especially `README.md`, current with any new features or configuration steps you add.
- Work on dedicated branches and keep commits small, focused, and descriptive about both the change and its motivation.
- Use feature flags or toggles for risky changes so they can be isolated and rolled back quickly when needed.
- Add or update automated tests whenever you introduce new behavior or fix a bug. If tests are not practical, document the manual verification you performed in the pull request description.

## Code style
- Match the existing formatting and naming conventions of the files you touch. If a formatter or linter configuration exists, run it before committing.
- Avoid introducing unused code or dependencies. Remove dead code as you encounter it and explain the removal in your commit message when it is not obvious.
- Comment complex or non-obvious logic, but keep straightforward code self-explanatory through clear naming.
- Write docstrings and comments that focus on purpose and behavior rather than implementation specifics.
- Favor pure functions and separation of responsibilities to limit cross-dependencies.

## Pull request expectations
- Summarize the key changes in a short, bulleted list at the top of the pull request description.
- Provide a dedicated "Testing" section that lists the commands or manual steps you ran, along with their results.
- Call out any follow-up work or known limitations so reviewers understand the current state of the feature.

## Testing
- Cover every new path with unit, integration, and end-to-end tests, prioritizing edge cases and known regressions.
- Keep unit suites fast; parallelize or split out slow suites (e.g., smoke vs. full) when necessary.
- Make tests deterministic by controlling external dependencies with mocks or fakes where appropriate.
- Update or extend coverage when behavior changes. If you modify contracts, write the failing test first (lightweight TDD) before updating the implementation.

## Reviews and controls
- Run automated static analysis, linting, type checking, and security scans before requesting a merge.
- Seek focused code reviews guided by a checklist that verifies contract stability, backward compatibility, performance considerations, and observability (logging/monitoring).
- Record scope, risks, and executed tests in the changelog or pull request description for reviewer context.

## Post-merge monitoring
- Integrate metrics and alerts that surface anomalies immediately after deployment.
- Maintain rollback procedures (release branches, versioned tags) to restore previous states quickly.
- After deploys, monitor key indicators and, if regressions appear, file bug reports with reproducible steps and failing tests.
