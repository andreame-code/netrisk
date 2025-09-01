export function renderUserMenu({ model, navigateTo, info, error }) {
  info?.("[AUTH] renderMenu");
  const menu = document.getElementById("userMenu");
  if (!menu) return;
  const nav = menu.closest("nav") || menu;

  const showLoggedOut = () => {
    menu.innerHTML = "";
    const login = document.createElement("a");
    login.href = "login.html";
    login.textContent = "Accedi";

    const register = document.createElement("a");
    register.href = "register.html";
    register.textContent = "Registrati";

    menu.append(login, register);
    nav.classList.remove("loading");
    menu.classList.remove("loading");
  };

  const showLoggedIn = (user) => {
    menu.innerHTML = "";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    const name = user.name || user.email || "";
    avatar.textContent = name.charAt(0).toUpperCase();

    const profile = document.createElement("a");
    profile.href = "account.html";
    profile.textContent = "Profilo";

    const logout = document.createElement("a");
    logout.href = "#";
    logout.textContent = "Esci";
    logout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await model.logout();
        renderUserMenu({ model, navigateTo, info, error });
        sessionStorage.setItem("flashMessage", "Sei uscito dall'account");
        navigateTo("index.html");
      } catch (err) {
        error?.("[AUTH] logout", err);
      }
    });

    menu.append(avatar, profile, logout);
    nav.classList.remove("loading");
    menu.classList.remove("loading");
  };

  return model
    .currentUser()
    .then((user) => {
      if (user) {
        showLoggedIn(user);
      } else {
        showLoggedOut();
      }
    })
    .catch((err) => {
      error?.("[AUTH] currentUser", err);
      showLoggedOut();
    });
}

export function showFlashMessage() {
  try {
    const msg = sessionStorage.getItem("flashMessage");
    if (msg) {
      const banner = document.createElement("div");
      banner.textContent = msg;
      banner.style.background = "#cfc";
      banner.style.color = "#000";
      banner.style.padding = "1em";
      banner.style.textAlign = "center";
      banner.style.position = "fixed";
      banner.style.top = "0";
      banner.style.left = "0";
      banner.style.right = "0";
      banner.style.zIndex = "9999";
      document.body?.prepend(banner);
      sessionStorage.removeItem("flashMessage");
    }
  } catch {
    // ignore storage errors
  }
}

export default { renderUserMenu, showFlashMessage };
