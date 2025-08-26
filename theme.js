export function initThemeToggle() {
  const body = document.body;
  if (!body) return;
  const btn = document.getElementById('themeToggle');
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'default';
  if (stored === 'high-contrast') {
    body.classList.add('high-contrast');
    if (btn) btn.textContent = 'Standard Theme';
  }
  if (!btn) return;
  btn.addEventListener('click', () => {
    body.classList.toggle('high-contrast');
    const high = body.classList.contains('high-contrast');
    btn.textContent = high ? 'Standard Theme' : 'High Contrast';
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('theme', high ? 'high-contrast' : 'default');
      } catch (err) {
        // ignore storage errors
      }
    }
  });
}
