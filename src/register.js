import supabase from './init/supabase-client.js';
import { navigateTo } from './navigation.js';
import { getSafeReferrer } from './utils/referrer.js';

const form = document.getElementById('registerForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
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
  const redirectUrl = new URL('login.html', window.location.href).href;
  const { data, error } = await supabase.auth.signUp({
    email: username,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });
  submitBtn.disabled = false;
  if (error) {
    message.textContent = 'Registrazione non riuscita';
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
