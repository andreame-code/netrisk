import { test, expect } from "@playwright/test";

test.describe("login", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.innerHTML =
        "* { transition: none !important; animation: none !important; }";
      document.head.appendChild(style);
    });
    await page.route("**/src/init/supabase-client.js*", (route) =>
      route.fulfill({
        body: `
          const supabase = {
            auth: {
              onAuthStateChange: () => {},
              getSession: async () => ({ data: { session: null }, error: null }),
              getUser: async () => ({ data: { user: null }, error: null }),
              signInWithPassword: async () => ({
                data: { user: { email: "user@example.com" }, session: {} },
                error: null,
              }),
              setSession: async () => ({ data: {}, error: null }),
            },
          };
          export default supabase;
        `,
        contentType: "application/javascript",
      }),
    );
    await page.route("**/supabase.co/**", (route) =>
      route.fulfill({
        status: 200,
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );
  });

  test("redirects to account after login", async ({ page }) => {
    await page.goto("/login.html");
    await expect(page.getByText("Unable to load data")).toHaveCount(0);
    await page.fill('[data-testid="login-username"]', "user@example.com");
    await page.fill('[data-testid="login-password"]', "password");
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL("**/account.html");
    await expect(page).toHaveURL(/account\.html$/);
    await expect(page.locator("h1")).toHaveText("Account");
  });
});
