const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const result = await postJson('/api/login', { username, password });
  message.textContent = result.error || 'Login successful';
});

registerBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const result = await postJson('/api/register', { username, password });
  message.textContent = result.error || 'Registration successful';
});
