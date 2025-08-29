import supabase from './init/supabase-client.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const hashed = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .select('password_hash')
    .eq('username', username)
    .single();
  if (error || !data || data.password_hash !== hashed) {
    message.textContent = 'Invalid username or password';
    return;
  }
  message.textContent = 'Login successful';
});

registerBtn.addEventListener('click', async () => {
  if (!supabase) {
    message.textContent = 'Supabase not configured';
    return;
  }
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const hashed = await hashPassword(password);
  const { error } = await supabase
    .from('users')
    .insert({ username, password_hash: hashed });
  if (error) {
    message.textContent = error.message;
    return;
  }
  message.textContent = 'Registration successful';
});
