import supabase from './init/supabase-client.js';

async function renderUserMenu() {
  const menu = document.getElementById('userMenu');
  if (!menu || !supabase) return;

  menu.innerHTML = '';
  menu.classList.add('loading');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  menu.classList.remove('loading');

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
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });

    menu.append(avatar, profile, logout);
  } else {
    const login = document.createElement('a');
    login.href = 'login.html';
    login.textContent = 'Accedi';

    const register = document.createElement('a');
    register.href = 'register.html';
    register.textContent = 'Registrati';

    menu.append(login, register);
  }
}

renderUserMenu();
supabase?.auth.onAuthStateChange(renderUserMenu);

