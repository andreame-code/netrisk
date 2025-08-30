import supabase from './init/supabase-client.js';

const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const anonymousBtn = document.getElementById('anonymousBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email: username, password });
  if (error) {
    message.textContent = error.message;
  } else {
    window.location.href = 'account.html';
  }
});

anonymousBtn?.addEventListener('click', async () => {
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  if (typeof supabase.auth.signInAnonymously !== 'function') {
    message.textContent = 'Anonymous login not supported';
    return;
  }
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    message.textContent = error.message;
  } else {
    window.location.href = 'account.html';
  }
});
