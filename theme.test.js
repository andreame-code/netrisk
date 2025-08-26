import { initThemeToggle } from './theme.js';

describe('theme toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="themeToggle">High Contrast</button>';
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
