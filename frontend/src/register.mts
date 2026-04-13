import { byId, maybeQuery, setDisabled, setHidden } from "./core/dom.mjs";
import { messageFromError } from "./core/errors.mjs";
import { t, translateServerMessage } from "./i18n.mjs";

const state = {
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

function registrationClientError(username, email, password, confirmPassword) {
  if (!username || !password || !confirmPassword) {
    return t("register.errors.requiredFields");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(username)) {
    return t("register.errors.invalidUsername");
  }

  if (password.length < 4) {
    return t("register.errors.shortPassword");
  }

  if (password !== confirmPassword) {
    return t("register.errors.passwordMismatch");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return t("register.errors.invalidEmail");
  }

  return "";
}

async function loginWithCredentials(username, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
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

    const data = await response.json();
    state.user = data.user;
    window.netriskTheme?.applyUserTheme?.(state.user);
  } catch (error) {
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
    ? t("register.auth.loggedIn", { username: state.user.username })
    : t("register.authStatus");
  renderNavAvatar(state.user?.username);
}

if (elements.headerLoginForm) {
  (elements.headerLoginForm as HTMLElement).dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername.value.trim();
    const password = elements.headerAuthPassword.value;
    if (!username || !password) {
      return;
    }

    try {
      await loginWithCredentials(username, password);
    } catch (error) {
      setFeedback(messageFromError(error, t("errors.loginFailed")), "error");
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
  } catch (error) {
  }

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
  const clientError = registrationClientError(username, email, password, confirmPassword);
  if (clientError) {
    setFeedback(clientError, "error");
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
    const data = await response.json();
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
