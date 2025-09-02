const { describe, test, expect, beforeEach } = global;

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = '';
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

describe('about page search and init', () => {
  test('filterSections shows all for empty query', () => {
    const { filterSections } = require('../src/about.js');
    document.body.innerHTML = `
      <div id="helpContent">
        <section id="s1"><h2>Rules</h2><p>Battle</p></section>
        <section id="s2"><h2>Tips</h2><p>Strategy</p></section>
      </div>`;
    filterSections('battle', document);
    filterSections('', document);
    const sections = document.querySelectorAll('#helpContent section');
    sections.forEach((sec) => {
      expect(sec.style.display).toBe('');
    });
  });

  test('filterSections is case insensitive', () => {
    const { filterSections } = require('../src/about.js');
    document.body.innerHTML = `
      <div id="helpContent">
        <section id="s1"><h2>Rules</h2><p>Battle</p></section>
        <section id="s2"><h2>Tips</h2><p>Strategy</p></section>
      </div>`;
    filterSections('BATTLE', document);
    const sections = document.querySelectorAll('#helpContent section');
    expect(sections[0].style.display).toBe('');
    expect(sections[1].style.display).toBe('none');
  });

  test('initAbout populates content and audio controls', () => {
    const { initAbout } = require('../src/about.js');
    const audio = require('../src/audio.js');
    document.body.innerHTML = `
      <h1 id="pageTitle"></h1>
      <div id="helpContent">
        <section id="credits"><h2></h2><div class="content"></div></section>
        <section id="changelog"><h2></h2><div class="content"></div></section>
        <section id="github"><h2></h2><div class="content"></div></section>
        <section id="settings">
          <h2></h2>
          <div class="content">
            <label for="themeSelect"></label>
            <select id="themeSelect"><option value="light">Light</option><option value="dark">Dark</option></select>
            <button id="themeToggle" class="btn">High Contrast</button>
            <label for="masterVolume"></label>
            <input id="masterVolume" type="range" min="0" max="1" step="0.01" value="0.2" />
            <button id="muteBtn" class="btn">Mute</button>
          </div>
        </section>
      </div>`;
    initAbout(document);
    expect(document.getElementById('pageTitle').textContent).toBe('About & Settings');
    expect(document.title).toBe('About & Settings - NetRisk');
    const credits = document.querySelector('#credits');
    expect(credits.querySelector('h2').textContent).toBe('Credits');
    expect(credits.querySelector('.content').textContent).toBe('Created by the NetRisk team.');
    const vol = document.getElementById('masterVolume');
    expect(vol.value).toBe('0.5');
    vol.value = '0.8';
    vol.dispatchEvent(new Event('input', { bubbles: true }));
    expect(audio.getMasterVolume()).toBeCloseTo(0.8);
    const muteBtn = document.getElementById('muteBtn');
    expect(muteBtn.textContent).toBe('Mute');
    muteBtn.click();
    expect(muteBtn.textContent).toBe('Unmute');
    expect(audio.isMuted()).toBe(true);
  });
});
