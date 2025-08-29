import supabase from './init/supabase-client.js';

function usernameToEmail(username) {
  const clean = username.trim().toLowerCase();
  return `${clean}@example.com`;
}

const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  const username = usernameInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    message.textContent = error.message;
    return;
  }
  message.textContent = 'Login successful';
});

registerBtn.addEventListener('click', async () => {
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  const username = usernameInput.value;
  const password = passwordInput.value;
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username } },
  });
  if (error) {
    message.textContent = error.message;
    return;
  }
  message.textContent = 'Registration successful';
});
