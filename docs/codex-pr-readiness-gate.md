# Codex PR Readiness Gate

## Scope

This repository includes an automated readiness gate for draft pull requests created through the Codex workflow.

The gate targets:

- draft PRs whose head branch starts with `codex/`
- draft PRs labeled `codex`
- draft PRs authored directly by the Codex GitHub actor when that actor is the PR author

It does not post noisy comments on unrelated pull requests.

## Workflow

The automation lives in [`.github/workflows/codex-pr-readiness.yml`](../.github/workflows/codex-pr-readiness.yml) and runs on:

- Codex-relevant draft PR events
- Codex-relevant review activity
- Codex-relevant comments that may contain a greenlight
- completion of the main CI workflows (`Quality`, `Coverage`, `E2E Smoke`, `CodeQL Advanced`)
- a recurring schedule every 30 minutes
- manual dispatch

The heavy logic is centralized in [`scripts/evaluate-codex-pr-readiness.cts`](../scripts/evaluate-codex-pr-readiness.cts).

## Hard blockers

The gate keeps the PR in draft when any of these remain true:

- a required GitHub check is missing, pending, or failed
- the `quality` workflow cannot prove the required step-level requirements:
  - repository typecheck
  - React shell typecheck
  - build
  - lint
  - format check
  - React shell tests
- the coverage job is not green
- the E2E smoke job is not green
- CodeQL is not green
- the PR has unresolved review threads
- the latest Codex signal after the current head commit is not an explicit greenlight
- the PR branch is behind the base branch
- GitHub reports the PR as not mergeable
- newly introduced skipped tests are detected in changed test files
- newly introduced `console.log`, `debugger`, `TODO`, `FIXME`, `temporary`, `placeholder`, or comment-style mock markers are detected in changed files unless allowlisted
- required generated outputs are out of sync

## Codex greenlight detection

The gate treats Codex greenlight as one of:

- an `APPROVED` review from `chatgpt-codex-connector`
- a Codex-authored review or issue comment containing one of:
  - `Codex greenlight`
  - `Codex PR readiness: greenlight`
  - `Codex final approval`

The greenlight must be newer than the latest PR head commit. If a later Codex comment appears after that commit and it is not a greenlight, the gate blocks readiness.

## Soft advisories

The gate warns, but does not block, when it detects:

- coverage risk from production changes without matching tests
- significant production changes without docs updates
- suspiciously large diffs
- unusually low test additions relative to production additions

## Sticky summary comment

The gate maintains a single reusable PR summary comment marked with:

`<!-- codex-pr-readiness-summary -->`

It updates that comment in place and avoids duplicate status comments. If the body is unchanged, it does not patch the comment again.

## Allowlists and tuning

Behavior is tuned in [`.github/codex-pr-readiness.json`](../.github/codex-pr-readiness.json), including:

- target label and branch prefix
- Codex actor list
- greenlight phrases
- required check names
- required `quality` step names
- freshness rule
- allowlists for skipped tests and temporary markers
- generated artifact sync requirements
- advisory thresholds

## Safety against false positives

The evaluator reduces false positives by:

- scanning only added diff lines for skipped tests and leftovers
- allowing explicit per-path marker allowlists
- checking generated sync only through explicit pair rules
- requiring the latest Codex signal after the current head commit to be a greenlight
- skipping unrelated PRs entirely
