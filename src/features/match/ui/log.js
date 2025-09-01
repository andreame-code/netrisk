export function appendLog(message) {
  const el = document.getElementById('matchLog');
  if (!el) return;
  const li = document.createElement('li');
  li.textContent = message;
  el.appendChild(li);
}
