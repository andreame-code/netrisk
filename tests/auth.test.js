describe("auth menu", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML =
      '<nav><div id="userMenu" class="loading"></div></nav>';
    const store = {};
    const mockSessionStorage = {
      getItem: jest.fn((key) => store[key]),
      setItem: jest.fn((key, value) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
      }),
    };
    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
    });
  });

  test("shows logged out links when supabase is null", async () => {
    jest.doMock("../src/init/supabase-client.js", () => ({
      __esModule: true,
      default: null,
    }));
    await require("../src/auth.js");
    await new Promise((r) => setTimeout(r, 0));
    expect(
      document.querySelector('#userMenu a[href="login.html"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('#userMenu a[href="register.html"]'),
    ).not.toBeNull();
  });

  test("shows logged out links when there is no session", async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session: null } });
    jest.doMock("../src/init/supabase-client.js", () => ({
      __esModule: true,
      default: { auth: { getSession } },
    }));
    await require("../src/auth.js");
    await new Promise((r) => setTimeout(r, 0));
    expect(getSession).toHaveBeenCalled();
    expect(
      document.querySelector('#userMenu a[href="login.html"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('#userMenu a[href="register.html"]'),
    ).not.toBeNull();
  });

  test("shows user menu when session exists and logs out on click", async () => {
    const signOut = jest.fn().mockResolvedValue({});
    const getSession = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              email: "foo@example.com",
              user_metadata: { full_name: "Foo Bar" },
            },
          },
        },
      })
      .mockResolvedValueOnce({ data: { session: null } });
    const navigateTo = jest.fn();
    jest.doMock("../src/navigation.js", () => ({ navigateTo }));
    jest.doMock("../src/init/supabase-client.js", () => ({
      __esModule: true,
      default: { auth: { getSession, signOut } },
    }));

    await require("../src/auth.js");
    await new Promise((r) => setTimeout(r, 0));

    const avatar = document.querySelector("#userMenu .avatar");
    const profile = document.querySelector('#userMenu a[href="account.html"]');
    const logout = document.querySelector('#userMenu a[href="#"]');
    expect(avatar).not.toBeNull();
    expect(profile).not.toBeNull();
    expect(logout).not.toBeNull();

    logout.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "flashMessage",
      "Sei uscito dall'account",
    );
    expect(navigateTo).toHaveBeenCalledWith("index.html");
  });
});
