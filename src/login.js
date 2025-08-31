import supabase from './init/supabase-client.js';
import { navigateTo } from './navigation.js';
import { getSafeReferrer } from './utils/referrer.js';

const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const anonymousBtn = document.getElementById('anonymousBtn');
const submitBtn = form?.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!supabase) {
    message.textContent = 'Supabase non configurato';
    return;
  }
  submitBtn.disabled = true;
  message.textContent = '';
  const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
  submitBtn.disabled = false;
  if (error) {
    message.textContent = 'Credenziali non valide';
    return;
  }
  const name = data.user?.email?.split('@')[0] || username;
  message.textContent = `Benvenuto, ${name} 👋`;
  const ref = getSafeReferrer();
  setTimeout(() => {
    if (ref) {
      window.location.href = ref;
    } else {
      navigateTo('account.html');
    }
  }, 1000);
});

anonymousBtn?.addEventListener('click', async () => {
  if (!supabase) {
    message.textContent = 'Supabase non configurato';
    return;
  }
  if (typeof supabase.auth.signInAnonymously !== 'function') {
    message.textContent = 'Accesso anonimo non supportato';
    return;
  }
  anonymousBtn.disabled = true;
  const { error } = await supabase.auth.signInAnonymously();
  anonymousBtn.disabled = false;
  if (error) {
    message.textContent = 'Errore di accesso anonimo';
    return;
  }
  message.textContent = 'Benvenuto, giocatore 👋';
  const ref = getSafeReferrer();
  setTimeout(() => {
    if (ref) {
      window.location.href = ref;
    } else {
      navigateTo('account.html');
    }
  }, 1000);
});
