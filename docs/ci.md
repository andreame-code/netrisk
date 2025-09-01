# Continuous Integration

## Pull Requests

- `lint.yml`: ESLint and type check.
- `ci.yml`:
  - Unit and integration tests (`npm test`)
  - Playwright smoke tests (`npm run test:e2e:smoke`)
  - Preview deploy if UI files changed (skipped for forked PRs).

## Main branch

- `lint.yml` on push.
- `e2e-full.yml`: full Playwright suite with visual regression.
  Baseline screenshots are generated at runtime and uploaded as artifacts.
- `pages.yml`: deploy to GitHub Pages.
- CodeQL analysis via GitHub's default setup.

## Scheduled

- Nightly full E2E (`e2e-full.yml`).
- Weekly CodeQL (default setup).

## Manual UAT

Start the **UAT** workflow from the Actions tab. The job summary contains the preview link for the current branch.

## Local testing

```bash
npm test               # unit/integration with mocked network
npm run test:e2e:smoke # Playwright smoke suite
npm run test:e2e:full  # full Playwright + visual regression
npm run lint           # lint and type check
```

The e2e commands automatically install Playwright browsers if missing.
To refresh visual baselines locally run:

```
npm run test:e2e:full -- --update-snapshots
```
