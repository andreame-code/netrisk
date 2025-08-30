import supabase from './init/supabase-client.js';

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

async function loadUser() {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  userNameEl.textContent = user.user_metadata?.name || 'N/A';
  userEmailEl.textContent = user.email || 'N/A';
}

logoutBtn?.addEventListener('click', async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

loadUser();
