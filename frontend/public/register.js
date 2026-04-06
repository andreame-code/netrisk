const state = {
  user: null,
  submitting: false
};

const elements = {
  headerLoginForm: document.querySelector("#header-login-form"),
  headerAuthUsername: document.querySelector("#header-auth-username"),
  headerAuthPassword: document.querySelector("#header-auth-password"),
  headerLoginButton: document.querySelector("#header-login-button"),
  authStatus: document.querySelector("#register-auth-status"),
  logoutButton: document.querySelector("#logout-button"),
  form: document.querySelector("#register-form"),
  username: document.querySelector("#register-username"),
  email: document.querySelector("#register-email"),
  password: document.querySelector("#register-password"),
  passwordConfirm: document.querySelector("#register-password-confirm"),
  feedback: document.querySelector("#register-feedback"),
  submit: document.querySelector("#register-submit-button")
};

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function setFeedback(message = "", tone = "") {
  if (!message) {
    elements.feedback.hidden = true;
    elements.feedback.textContent = "";
    elements.feedback.className = "auth-feedback";
    return;
  }

  elements.feedback.hidden = false;
  elements.feedback.textContent = message;
  elements.feedback.className = `auth-feedback${tone === "error" ? " is-error" : " is-success"}`;
}

function registrationClientError(username, email, password, confirmPassword) {
  if (!username || !password || !confirmPassword) {
    return "Compila i campi obbligatori.";
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(username)) {
    return "Username valido: 3-32 caratteri, lettere, numeri, underscore e trattino.";
  }

  if (password.length < 4) {
    return "Usa una password con almeno 4 caratteri.";
  }

  if (password !== confirmPassword) {
    return "Le password non coincidono.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Email non valida.";
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
    throw new Error(data.error || "Accesso non riuscito.");
  }

  state.user = data.user;
  render();
  window.location.href = "/profile.html";
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      throw new Error("Sessione scaduta");
    }

    const data = await response.json();
    state.user = data.user;
  } catch (error) {
    state.user = null;
  }
}

function render() {
  const isAuthenticated = Boolean(state.user);
  if (elements.headerLoginForm) {
    elements.headerLoginForm.hidden = isAuthenticated;
    elements.headerAuthUsername.disabled = isAuthenticated;
    elements.headerAuthPassword.disabled = isAuthenticated;
    elements.headerLoginButton.disabled = isAuthenticated;
  }

  elements.logoutButton.hidden = !isAuthenticated;
  elements.logoutButton.disabled = !isAuthenticated;
  elements.submit.disabled = state.submitting || isAuthenticated;
  elements.authStatus.textContent = isAuthenticated
    ? `Hai gia effettuato l'accesso come ${state.user.username}.`
    : "Compila il modulo per creare l'account.";
  renderNavAvatar(state.user?.username);
}

if (elements.headerLoginForm) {
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
      setFeedback(error.message, "error");
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
      throw new Error(data.error || "Registrazione non riuscita.");
    }

    await loginWithCredentials(username, password);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    state.submitting = false;
    render();
  }
});

await restoreSession();
render();
