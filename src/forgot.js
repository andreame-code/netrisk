import { setupAuthForm } from './utils/auth-forms.js';
import { navigateTo } from './navigation.js';

const emailInput = document.getElementById('email');

setupAuthForm('forgotForm', async ({ supabase, message }) => {
  const email = emailInput.value.trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    message.textContent = 'Reset password non riuscito';
    return;
  }
  const msg = "Se l'email esiste, riceverai un link per reimpostare la password";
  message.textContent = msg;
  setTimeout(() => {
    navigateTo(`login.html?message=${encodeURIComponent(msg)}`);
  }, 1000);
});
