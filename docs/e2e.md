# End-to-End Testing

This guide covers the setup required to run the Playwright end-to-end suites.

## Create a test user in Supabase

1. Open the Supabase dashboard and select your project.
2. Navigate to **Authentication → Users** and click **Add user**.
3. Provide an email and password for the test account and choose **Add user** (no invitation).
   The account is created and confirmed immediately.
4. Use these credentials in the `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` secrets.

## Repository secrets and variables

In the GitHub repository go to **Settings → Secrets and variables → Actions** and create:

- **Secrets**
  - `E2E_TEST_EMAIL` – email address of the test user.
  - `E2E_TEST_PASSWORD` – password of the test user.
- **Variables**
  - `E2E_BASE_URL` – base URL that Playwright should target (e.g. the preview deployment URL).

These values are read by the CI workflows before running the end‑to‑end suites.

## Running tests locally with BASE_URL overrides

By default the Playwright configuration points to `http://localhost:5173`.  
You can run the E2E suites against any URL by passing `--base-url`:

```bash
npm run test:e2e:smoke -- --base-url http://localhost:5173
npm run test:e2e:full -- --base-url https://example.com
```

You may also export the value once and reuse it:

```bash
export BASE_URL=http://localhost:5173
npm run test:e2e:smoke -- --base-url "$BASE_URL"
```
