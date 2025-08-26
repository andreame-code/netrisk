import {
  setMasterVolume,
  getMasterVolume,
  setMuted,
  isMuted,
} from './audio.js';
import { initThemeToggle, initThemeSelect } from './theme.js';

const lang = navigator.language && navigator.language.startsWith('it') ? 'it' : 'en';

const texts = {
  en: {
    title: 'About & Settings',
    sections: {
      credits: {
        title: 'Credits',
        content: 'Created by the NetRisk team.',
      },
      changelog: {
        title: 'Changelog',
        content: '<ul><li>v0.1: Initial alpha release.</li></ul>',
      },
      github: {
        title: 'GitHub',
        content:
          '<a href="https://github.com" target="_blank" rel="noopener">Source code on GitHub</a>',
      },
      settings: { title: 'Settings', content: '' },
    },
  },
  it: {
    title: 'Info e Impostazioni',
    sections: {
      credits: {
        title: 'Credits',
        content: 'Creato dal team NetRisk.',
      },
      changelog: {
        title: 'Changelog',
        content: '<ul><li>v0.1: Rilascio alpha iniziale.</li></ul>',
      },
      github: {
        title: 'GitHub',
        content:
          '<a href="https://github.com" target="_blank" rel="noopener">Codice sorgente su GitHub</a>',
      },
      settings: { title: 'Impostazioni', content: '' },
    },
  },
};

export function filterSections(query, doc = document) {
  const sections = doc.querySelectorAll('#helpContent section');
  sections.forEach((sec) => {
    if (sec.textContent.toLowerCase().includes(query.toLowerCase())) {
      sec.style.display = '';
    } else {
      sec.style.display = 'none';
    }
  });
}

export function initAbout(doc = document) {
  const t = texts[lang];
  doc.getElementById('pageTitle').textContent = t.title;
  doc.title = `${t.title} - NetRisk`;
  Object.entries(t.sections).forEach(([id, data]) => {
    const section = doc.getElementById(id);
    if (!section) return;
    section.querySelector('h2').textContent = data.title;
    if (data.content) {
      section.querySelector('.content').innerHTML = data.content;
    }
  });
  initThemeToggle(doc);
  initThemeSelect(doc);
  const vol = doc.getElementById('masterVolume');
  if (vol) {
    vol.value = getMasterVolume();
    vol.addEventListener('input', (e) => {
      setMasterVolume(parseFloat(e.target.value));
    });
  }
  const muteBtn = doc.getElementById('muteBtn');
  if (muteBtn) {
    muteBtn.textContent = isMuted() ? 'Unmute' : 'Mute';
    muteBtn.addEventListener('click', () => {
      const muted = isMuted();
      setMuted(!muted);
      muteBtn.textContent = muted ? 'Mute' : 'Unmute';
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => initAbout());
}

export default { initAbout, filterSections };
