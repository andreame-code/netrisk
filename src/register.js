import { setupAuthForm } from './utils/auth-forms.js';
import { navigateTo } from './navigation.js';
import { getSafeReferrer } from './utils/referrer.js';

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

setupAuthForm('registerForm', async ({ supabase, message }) => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const redirectUrl = new URL('login.html', window.location.href).href;
  const { data, error } = await supabase.auth.signUp({
    email: username,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });
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
