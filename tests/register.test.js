describe("register page", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <form id="registerForm">
        <input id="username" />
        <input id="password" />
        <button type="submit" class="btn">Register</button>
      </form>
      <p id="message" role="alert"></p>
    `;
  });

  test("falls back to account page for external referrer after registration", async () => {
    Object.defineProperty(document, "referrer", {
      value: "https://evil.com/",
      configurable: true,
    });
    jest.useFakeTimers();

    const navigateTo = jest.fn();
    jest.doMock("../src/navigation.js", () => ({ navigateTo }));

    jest.doMock("../src/init/supabase-client.js", () => ({
      __esModule: true,
      default: {
        auth: {
          signUp: jest.fn().mockResolvedValue({
            data: { user: { email: "foo@example.com" } },
            error: null,
          }),
        },
      },
    }));

    require("../src/register.js");
    document.getElementById("username").value = "foo@example.com";
    document.getElementById("password").value = "pass";
    document.getElementById("registerForm").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    jest.runAllTimers();

    expect(navigateTo).toHaveBeenCalledWith("account.html");
    jest.useRealTimers();
    Object.defineProperty(document, "referrer", {
      value: "",
      configurable: true,
    });
  });
});
