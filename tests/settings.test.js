const { describe, test, beforeEach, expect } = global;

describe('settings persistence between pages', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    document.body.innerHTML = '';
  });

  test('audio and theme survive reload', () => {
    const audio1 = require('../audio.js');
    const theme1 = require('../theme.js');
    audio1.setMasterVolume(0.25);
    audio1.setMuted(true);
    document.body.innerHTML = '<button id="themeToggle" class="btn">High Contrast</button>';
    theme1.initThemeToggle();
    document.getElementById('themeToggle').click();

    jest.resetModules();
    document.body.innerHTML = '';
    const audio2 = require('../audio.js');
    const theme2 = require('../theme.js');
    theme2.initThemeToggle();
    expect(audio2.getMasterVolume()).toBe(0.25);
    expect(audio2.isMuted()).toBe(true);
    expect(document.body.classList.contains('high-contrast')).toBe(true);
  });
});
