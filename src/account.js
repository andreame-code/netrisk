import supabase from './init/supabase-client.js';

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const userAvatarEl = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const updateNameBtn = document.getElementById('updateNameBtn');
const recentLobbiesEl = document.getElementById('recentLobbies');
const prefColorEl = document.getElementById('prefColor');
const prefMapEl = document.getElementById('prefMap');

function renderAvatar(user) {
  if (!userAvatarEl) return;
  const url = user.user_metadata?.avatar_url;
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = user.user_metadata?.name || user.email || '';
    userAvatarEl.innerHTML = '';
    userAvatarEl.appendChild(img);
  } else {
    const name = user.user_metadata?.name || user.email || 'U';
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
  }
}

async function loadLobbies(user) {
  if (!supabase || !recentLobbiesEl) return;
  const queries = [
    supabase.from('lobbies').select('code, map').eq('host', user.id).limit(5),
    supabase
      .from('lobbies')
      .select('code, map')
      .contains('players', [{ id: user.id }])
      .limit(5),
  ];
  const results = await Promise.allSettled(queries);
  const data = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value.data || []);
  const unique = Array.from(new Map(data.map((l) => [l.code, l])).values());
  recentLobbiesEl.innerHTML =
    unique.length > 0
      ? unique
          .slice(0, 5)
          .map((l) => `<li>${l.code} - ${l.map || ''}</li>`)
          .join('')
      : '<li>Nessuna lobby recente</li>';
}

function loadPreferences() {
  let players = null;
  try {
    players = JSON.parse(localStorage.getItem('netriskPlayers'));
  } catch {
    players = null;
  }
  const color = players?.[0]?.color || 'N/A';
  let map = null;
  try {
    map = localStorage.getItem('netriskMap');
  } catch {
    map = null;
  }
  if (prefColorEl) prefColorEl.textContent = color || 'N/A';
  if (prefMapEl) prefMapEl.textContent = map || 'N/A';
}

async function loadUser() {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const msg = encodeURIComponent('Accedi per vedere il tuo profilo');
    window.location.href = `login.html?message=${msg}`;
    return null;
  }
  userNameEl.textContent = user.user_metadata?.name || 'N/A';
  userEmailEl.textContent = user.email || 'N/A';
  renderAvatar(user);
  return user;
}

logoutBtn?.addEventListener('click', async () => {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'global' });
  window.location.href = 'index.html';
});

changePasswordBtn?.addEventListener('click', async () => {
  if (!supabase) return;
  const newPass = window.prompt('Nuova password:');
  if (!newPass) return;
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) {
    window.alert('Errore nel cambio password');
  } else {
    window.alert('Password aggiornata');
  }
});

updateNameBtn?.addEventListener('click', async () => {
  if (!supabase) return;
  const newName = window.prompt('Nuovo nome:');
  if (!newName) return;
  const { error } = await supabase.auth.updateUser({ data: { name: newName } });
  if (!error && userNameEl) {
    userNameEl.textContent = newName;
  }
});

async function init() {
  const user = await loadUser();
  if (user) {
    loadLobbies(user);
    loadPreferences();
  }
}

init();
