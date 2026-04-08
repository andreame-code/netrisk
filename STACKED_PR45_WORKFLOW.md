# Stacked Workflow for PR 45

PR `#45` stays the main integration PR until the whole fine tuning set is ready for `main`.

Current structure:

- parent PR: `#45`
- parent branch: `codex/modular-risk-engine-20260408`
- child branch prefix: `codex/pr45-`

## Create a child branch

Create each fine tuning branch from the current head of PR 45, not from `main`.

```bash
npm run pr45:branch -- lobby-polish
```

Example output branch:

```text
codex/pr45-lobby-polish
```

## Open the stacked child PR

After you commit your changes on the child branch, open the PR against the PR 45 branch:

```bash
npm run pr45:pr -- "Lobby polish"
```

This creates a PR with:

- base: `codex/modular-risk-engine-20260408`
- head: your current `codex/pr45-*` branch

If you want a draft PR:

```bash
npm run pr45:pr -- "Lobby polish" --draft
```

## Merge order

Use this sequence:

1. Merge each child PR into `codex/modular-risk-engine-20260408`
2. Let PR `#45` accumulate all merged child work
3. Only when satisfied, merge PR `#45` into `main`

## Guardrails

- Never point child PRs to `main`
- Never retarget PR `#45` away from `main`
- Keep child branches focused on one fine tuning topic each
- Delete child branches after merge if they are no longer needed
