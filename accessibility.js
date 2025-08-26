import { initThemeToggle } from './theme.js';

export function initAccessibility() {
  const body = document.body;
  if (!body) return;

  initThemeToggle();

  const root = document.documentElement;
  const fontSelect = document.getElementById('fontScale');
  if (fontSelect && root) {
    const storedScale =
      (typeof localStorage !== 'undefined' && localStorage.getItem('font-scale')) || '1';
    root.style.setProperty('--font-scale', storedScale);
    fontSelect.value = storedScale;
    fontSelect.addEventListener('change', () => {
      const scale = fontSelect.value;
      root.style.setProperty('--font-scale', scale);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('font-scale', scale);
        } catch (err) {
          /* ignore storage errors */
        }
      }
    });
  }

  const cbBtn = document.getElementById('colorBlindToggle');
  if (cbBtn) {
    const stored =
      typeof localStorage !== 'undefined' && localStorage.getItem('colorblind');
    if (stored === 'on') {
      body.classList.add('colorblind');
      cbBtn.textContent = 'Standard Colors';
    }
    cbBtn.addEventListener('click', () => {
      body.classList.toggle('colorblind');
      const on = body.classList.contains('colorblind');
      cbBtn.textContent = on ? 'Standard Colors' : 'Color Blind Mode';
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('colorblind', on ? 'on' : 'off');
        } catch (err) {
          /* ignore storage errors */
        }
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'h') {
      const btn = document.getElementById('themeToggle');
      if (btn) btn.click();
    }
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      if (cbBtn) cbBtn.click();
    }
    if (e.altKey && e.shiftKey && (e.key === '+' || e.key === '=')) {
      adjustFont(0.25);
    }
    if (e.altKey && e.shiftKey && e.key === '-') {
      adjustFont(-0.25);
    }
  });

  function adjustFont(delta) {
    const current =
      parseFloat(root.style.getPropertyValue('--font-scale') || '1');
    const next = Math.min(2, Math.max(0.5, current + delta));
    root.style.setProperty('--font-scale', next.toString());
    if (fontSelect) fontSelect.value = next.toString();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('font-scale', next.toString());
      } catch (err) {
        /* ignore storage errors */
      }
    }
  }
}
