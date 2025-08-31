import supabase from './init/supabase-client.js';
import { navigateTo } from './navigation.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export async function renderUserMenu() {
  const menu = document.getElementById('userMenu');
  if (!menu) return;

  const nav = menu.closest('nav') || menu;
  menu.innerHTML = '';
  nav.classList.add('loading');

  const showLoggedOut = () => {
    menu.innerHTML = '';
    const login = document.createElement('a');
    login.href = 'login.html';
    login.textContent = 'Accedi';

    const register = document.createElement('a');
    register.href = 'register.html';
    register.textContent = 'Registrati';

    menu.append(login, register);
    nav.classList.remove('loading');
    menu.classList.remove('loading');
  };

  if (!supabase) {
    showLoggedOut();
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const banner = document.createElement('div');
      banner.textContent = 'Servizio temporaneamente non disponibile, riprova';
      banner.style.background = '#fcc';
      banner.style.color = '#000';
      banner.style.padding = '1em';
      banner.style.textAlign = 'center';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.zIndex = '9999';
      document.body?.prepend(banner);
    }
    return;
  }

  const timeout = setTimeout(showLoggedOut, 5000);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    clearTimeout(timeout);
    nav.classList.remove('loading');
    menu.classList.remove('loading');

    const user = session?.user;

    if (user) {
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      const name = user.user_metadata?.full_name || user.email || '';
      avatar.textContent = name.charAt(0).toUpperCase();

      const profile = document.createElement('a');
      profile.href = 'account.html';
      profile.textContent = 'Profilo';

      const logout = document.createElement('a');
      logout.href = '#';
      logout.textContent = 'Esci';
      logout.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut({ scope: 'global' });
        await renderUserMenu();
        try {
          sessionStorage.setItem('flashMessage', 'Sei uscito dall\'account');
        } catch {
          // ignore storage errors
        }
        navigateTo('index.html');
      });

      menu.append(avatar, profile, logout);
    } else {
      showLoggedOut();
    }
  } catch {
    clearTimeout(timeout);
    showLoggedOut();
  }
}

renderUserMenu();
supabase?.auth.onAuthStateChange(renderUserMenu);

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

