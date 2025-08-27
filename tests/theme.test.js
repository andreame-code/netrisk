import { initThemeToggle, initThemeSelect } from '../src/theme.js';

describe('theme toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="themeToggle" class="btn">High Contrast</button>';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('toggles high contrast and stores preference', () => {
    initThemeToggle();
    const btn = document.getElementById('themeToggle');
    btn.click();
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    expect(btn.textContent).toBe('Standard Theme');
    expect(localStorage.getItem('theme')).toBe('high-contrast');
    btn.click();
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    expect(btn.textContent).toBe('High Contrast');
    expect(localStorage.getItem('theme')).toBe('default');
  });

  test('loads stored preference', () => {
    localStorage.setItem('theme', 'high-contrast');
    initThemeToggle();
    expect(document.body.classList.contains('high-contrast')).toBe(true);
  });
});

describe('theme select', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select id="themeSelect"><option value="light">Light</option><option value="dark">Dark</option></select>';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('applies stored theme and saves changes', () => {
    localStorage.setItem('colorTheme', 'dark');
    initThemeSelect();
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    const sel = document.getElementById('themeSelect');
    sel.value = 'light';
    sel.dispatchEvent(new Event('change'));
    expect(document.body.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('colorTheme')).toBe('light');
  });
});
