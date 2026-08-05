# Visual regression environment

Linux screenshot baselines are generated and compared only in the following rendering environment:

- `@playwright/test` 1.61.1;
- Chromium `149.0.7827.55`, Playwright revision `1228`;
- Ubuntu 24.04 (`noble`);
- Playwright container `mcr.microsoft.com/playwright:v1.61.1-noble`;
- the Playwright Ubuntu font dependencies `fonts-freefont-ttf`, `fonts-ipafont-gothic`, `fonts-liberation`, `fonts-noto-color-emoji`, `fonts-tlwg-loma-otf`, `fonts-unifont`, `fonts-wqy-zenhei`, `libfontconfig1`, and `libfreetype6`.

The expected Latin fallback families are Liberation Sans, Liberation Serif, and Liberation Mono. Noto Color Emoji is required for emoji rendering. Proprietary first-choice fonts referenced by the application (`Arial`, `Georgia`, `Helvetica Neue`, `Inter`, `Segoe UI`, and `Trebuchet MS`) must not be installed in the Linux snapshot environment because they change text metrics and rasterization.

## Supported commands

On an Ubuntu 24.04 host, bootstrap and run the visual suite with:

```bash
npm ci
npm run e2e:visual:install
npm run e2e:visual:preflight
npm run test:e2e:visual
```

The reproducible local workflow uses the exact CI image:

```bash
docker run --rm --init --ipc=host \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  bash -lc "npm ci && npm run test:e2e:visual"
```

The preflight launches Chromium before the application server starts, reports the detected versions and executable, verifies the Linux release and font stack, and exits with a bootstrap hint if anything differs. A compatible-looking system Chromium is intentionally rejected.

GitHub Actions runs the same visual command in the pinned container. Playwright keeps failed test output in `test-results`; the workflow uploads that directory and `playwright-report` so expected, actual, and diff images remain available for diagnosis.

Only run `npm run test:e2e:update` after an approved UI change and in the supported environment. Never update baselines merely to silence an unexplained browser or font mismatch.
