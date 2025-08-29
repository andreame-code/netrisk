import supabase from './init/supabase-client.js';

const form = document.getElementById('registerForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  const { error } = await supabase.auth.signUp({ email: username, password });
  message.textContent = error ? error.message : 'Registration successful';
});
