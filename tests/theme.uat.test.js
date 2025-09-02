import { applyColorTheme, initThemeToggle, initThemeSelect } from '../src/theme.js';

describe('applyColorTheme', () => {
  beforeEach(() => {
    document.body.className = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('adds dark-theme class when stored value is "dark"', () => {
    localStorage.setItem('colorTheme', 'dark');
    applyColorTheme();
    expect(document.body.classList.contains('dark-theme')).toBe(true);
  });

  test('removes dark-theme class when stored value is "light"', () => {
    document.body.classList.add('dark-theme');
    localStorage.setItem('colorTheme', 'light');
    applyColorTheme();
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });
});

describe('initThemeToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="themeToggle" class="btn">High Contrast</button>';
    document.body.className = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('toggles high contrast class and persists preference', () => {
    initThemeToggle();
    const btn = document.getElementById('themeToggle');
    btn.click();
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('high-contrast');
    btn.click();
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('default');
  });

  test('loads stored high contrast preference', () => {
    localStorage.setItem('theme', 'high-contrast');
    initThemeToggle();
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    const btn = document.getElementById('themeToggle');
    expect(btn.textContent).toBe('Standard Theme');
  });
});

describe('initThemeSelect', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select id="themeSelect"><option value="light">Light</option><option value="dark">Dark</option></select>';
    document.body.className = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('reflects stored selection and persists changes', () => {
    localStorage.setItem('colorTheme', 'dark');
    initThemeSelect();
    const sel = document.getElementById('themeSelect');
    expect(sel.value).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    sel.value = 'light';
    sel.dispatchEvent(new Event('change'));
    expect(document.body.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('colorTheme')).toBe('light');
  });

  test('defaults to light theme when no preference stored', () => {
    initThemeSelect();
    const sel = document.getElementById('themeSelect');
    expect(sel.value).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });
});
