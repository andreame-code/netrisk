# Repository Guidelines

This file is the canonical reference for repository-specific instructions. All contributors should read it before making changes.

## Development workflow
- Keep all project documentation, especially `README.md`, current with any new features or configuration steps you add.
- Prefer small, focused commits with descriptive messages that explain the why behind the change.
- Add or update automated tests whenever you introduce new behavior or fix a bug. If tests are not practical, document the manual verification you performed in the pull request description.

## Code style
- Match the existing formatting and naming conventions of the files you touch. If a formatter or linter configuration exists, run it before committing.
- Avoid introducing unused code or dependencies. Remove dead code as you encounter it and explain the removal in your commit message when it is not obvious.
- Comment complex or non-obvious logic, but keep straightforward code self-explanatory through clear naming.

## Pull request expectations
- Summarize the key changes in a short, bulleted list at the top of the pull request description.
- Provide a dedicated "Testing" section that lists the commands or manual steps you ran, along with their results.
- Call out any follow-up work or known limitations so reviewers understand the current state of the feature.
