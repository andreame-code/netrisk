import supabase from './init/supabase-client.js';

async function updateAuthLink() {
  const authLink = document.getElementById('authLink');
  if (!authLink || !supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    authLink.textContent = 'Logout';
    authLink.href = '#';
    authLink.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    };
  } else {
    authLink.textContent = 'Login';
    authLink.href = 'login.html';
    authLink.onclick = null;
  }
}

updateAuthLink();
supabase?.auth.onAuthStateChange(updateAuthLink);
