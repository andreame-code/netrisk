export function renderUserMenu({ user, onLogout }) {
  const menu = document.getElementById('userMenu');
  if (!menu) return;
  const nav = menu.closest('nav') || menu;
  menu.innerHTML = '';

  const showLoggedOut = () => {
    const login = document.createElement('a');
    login.href = 'login.html';
    login.textContent = 'Accedi';
    const register = document.createElement('a');
    register.href = 'register.html';
    register.textContent = 'Registrati';
    menu.append(login, register);
  };

  if (user) {
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    const name = user.name || user.email || '';
    avatar.textContent = name.charAt(0).toUpperCase();
    const profile = document.createElement('a');
    profile.href = 'account.html';
    profile.textContent = 'Profilo';
    const logout = document.createElement('a');
    logout.href = '#';
    logout.textContent = 'Esci';
    if (onLogout) {
      logout.addEventListener('click', e => {
        e.preventDefault();
        onLogout();
      });
    }
    menu.append(avatar, profile, logout);
  } else {
    showLoggedOut();
  }

  nav.classList.remove('loading');
  menu.classList.remove('loading');
}

export function showFlashMessage() {
  try {
    const msg = sessionStorage.getItem('flashMessage');
    if (msg) {
      const banner = document.createElement('div');
      banner.textContent = msg;
      banner.style.background = '#cfc';
      banner.style.color = '#000';
      banner.style.padding = '1em';
      banner.style.textAlign = 'center';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.zIndex = '9999';
      document.body?.prepend(banner);
      sessionStorage.removeItem('flashMessage');
    }
  } catch {
    // ignore storage errors
  }
}
