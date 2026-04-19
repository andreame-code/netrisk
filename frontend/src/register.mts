import { byId, maybeQuery, setDisabled, setHidden } from "./core/dom.mjs";
import { messageFromError } from "./core/errors.mjs";
import { validateRegistrationInput } from "./core/register-validation.mjs";
import type { LoginResponse, PublicUser, SessionResponse } from "./core/types.mjs";
import { t, translateServerMessage } from "./i18n.mjs";

const state: {
  user: PublicUser | null;
  submitting: boolean;
} = {
  user: null,
  submitting: false
};

const elements = {
  headerLoginForm: maybeQuery("#header-login-form"),
  headerAuthUsername: maybeQuery<HTMLInputElement>("#header-auth-username"),
  headerAuthPassword: maybeQuery<HTMLInputElement>("#header-auth-password"),
  headerLoginButton: maybeQuery<HTMLButtonElement>("#header-login-button"),
  authStatus: byId("register-auth-status"),
  logoutButton: byId("logout-button") as HTMLButtonElement,
  form: byId("register-form") as HTMLFormElement,
  username: byId("register-username") as HTMLInputElement,
  email: byId("register-email") as HTMLInputElement,
  password: byId("register-password") as HTMLInputElement,
  passwordConfirm: byId("register-password-confirm") as HTMLInputElement,
  feedback: byId("register-feedback"),
  submit: byId("register-submit-button") as HTMLButtonElement
};

function setHeaderAuthFeedback(message = ""): void {
  if (!message) {
    window.netriskShell?.clearHeaderAuthFeedback?.();
    return;
  }

  window.netriskShell?.setHeaderAuthFeedback?.(message, "error");
}

function renderNavAvatar(username = "") {
  const avatar = maybeQuery("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function setFeedback(message = "", tone = "") {
  if (!message) {
    setHidden(elements.feedback, true);
    elements.feedback.textContent = "";
    elements.feedback.className = "auth-feedback";
    return;
  }

  setHidden(elements.feedback, false);
  elements.feedback.textContent = message;
  elements.feedback.className = `auth-feedback${tone === "error" ? " is-error" : " is-success"}`;
}

async function loginWithCredentials(username: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = (await response.json()) as LoginResponse;
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.loginFailed")));
  }

  state.user = data.user;
  window.netriskTheme?.applyUserTheme?.(state.user);
  render();
  window.location.href = "/profile.html";
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      throw new Error(t("auth.sessionExpired"));
    }

    const data = (await response.json()) as SessionResponse;
    state.user = data.user;
    window.netriskTheme?.applyUserTheme?.(state.user);
  } catch (_error) {
    state.user = null;
  }
}

function render() {
  const isAuthenticated = Boolean(state.user);
  if (elements.headerLoginForm) {
    setHidden(elements.headerLoginForm as HTMLElement, isAuthenticated);
    if (elements.headerAuthUsername) {
      setDisabled(elements.headerAuthUsername, isAuthenticated);
    }
    if (elements.headerAuthPassword) {
      setDisabled(elements.headerAuthPassword, isAuthenticated);
    }
    if (elements.headerLoginButton) {
      setDisabled(elements.headerLoginButton, isAuthenticated);
    }
  }

  setHidden(elements.logoutButton, !isAuthenticated);
  setDisabled(elements.logoutButton, !isAuthenticated);
  setDisabled(elements.submit, state.submitting || isAuthenticated);
  elements.authStatus.textContent = isAuthenticated
    ? t("register.auth.loggedIn", { username: state.user?.username || "" })
    : t("register.authStatus");
  if (isAuthenticated) {
    setHeaderAuthFeedback("");
  }
  renderNavAvatar(state.user?.username);
}

if (elements.headerLoginForm) {
  (elements.headerLoginForm as HTMLElement).dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername?.value.trim() || "";
    const password = elements.headerAuthPassword?.value || "";
    if (!username || !password) {
      setHeaderAuthFeedback(t("auth.login.requiredFields"));
      return;
    }

    try {
      setHeaderAuthFeedback("");
      await loginWithCredentials(username, password);
    } catch (error) {
      setHeaderAuthFeedback(messageFromError(error, t("errors.loginFailed")));
      render();
    }
  });
}

elements.logoutButton.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  } catch (_error) {}

  state.user = null;
  render();
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.submitting || state.user) {
    return;
  }

  const username = elements.username.value.trim();
  const email = elements.email.value.trim();
  const password = elements.password.value;
  const confirmPassword = elements.passwordConfirm.value;
  const clientErrorKey = validateRegistrationInput({
    username,
    email,
    password,
    confirmPassword
  });
  if (clientErrorKey) {
    setFeedback(t(clientErrorKey), "error");
    return;
  }

  state.submitting = true;
  render();
  setFeedback();

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });
    const data = (await response.json()) as LoginResponse;
    if (!response.ok) {
      throw new Error(translateServerMessage(data, t("register.errors.submitFailed")));
    }

    await loginWithCredentials(username, password);
  } catch (error) {
    setFeedback(messageFromError(error, t("register.errors.submitFailed")), "error");
  } finally {
    state.submitting = false;
    render();
  }
});

await restoreSession();
render();
