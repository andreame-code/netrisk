import supabase from './init/supabase-client.js';
import { navigateTo } from './navigation.js';

const form = document.getElementById('forgotForm');
const message = document.getElementById('message');
const emailInput = document.getElementById('email');
const submitBtn = form?.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!supabase) {
    message.textContent = 'Supabase non configurato';
    return;
  }
  submitBtn.disabled = true;
  message.textContent = '';
  await supabase.auth.resetPasswordForEmail(email);
  const msg = "Se l'email esiste, riceverai un link per reimpostare la password";
  message.textContent = msg;
  setTimeout(() => {
    navigateTo(`login.html?message=${encodeURIComponent(msg)}`);
  }, 1000);
});
