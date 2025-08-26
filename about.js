import { setMasterVolume, getMasterVolume, setMuted, isMuted } from './audio.js';
import { initThemeToggle } from './theme.js';

const lang = navigator.language && navigator.language.startsWith('it') ? 'it' : 'en';

const texts = {
  en: {
    title: 'About & Settings',
    sections: {
      settings: {
        title: 'Settings',
        content:
          '<label for="volumeSetting">Volume:</label>' +
          '<input type="range" id="volumeSetting" min="0" max="1" step="0.01" />' +
          '<button id="muteBtn" class="btn">Mute</button>' +
          '<button id="themeToggle" class="btn">High Contrast</button>',
      },
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
    },
  },
  it: {
    title: 'Info e Impostazioni',
    sections: {
      settings: {
        title: 'Impostazioni',
        content:
          '<label for="volumeSetting">Volume:</label>' +
          '<input type="range" id="volumeSetting" min="0" max="1" step="0.01" />' +
          '<button id="muteBtn" class="btn">Mute</button>' +
          '<button id="themeToggle" class="btn">High Contrast</button>',
      },
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
    section.querySelector('.content').innerHTML = data.content;
  });
  initThemeToggle();
  const vol = doc.getElementById('volumeSetting');
  if (vol) {
    vol.value = getMasterVolume();
    vol.addEventListener('input', (e) => setMasterVolume(parseFloat(e.target.value)));
  }
  const muteBtn = doc.getElementById('muteBtn');
  if (muteBtn) {
    const updateMuteText = () => {
      muteBtn.textContent = isMuted() ? 'Unmute' : 'Mute';
    };
    updateMuteText();
    muteBtn.addEventListener('click', () => {
      setMuted(!isMuted());
      updateMuteText();
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => initAbout());
}

export default { initAbout, filterSections };
