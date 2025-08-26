const lang = navigator.language && navigator.language.startsWith('it') ? 'it' : 'en';

const texts = {
  en: {
    title: 'About & Settings',
    search: 'Search...',
    sections: {
      rules: {
        title: 'Rules',
        content:
          'Each player deploys armies, attacks adjacent territories and ends the turn. Conquer all territories to win.',
      },
      tips: {
        title: 'Tips',
        content: 'Expand early, defend borders and watch your opponents.',
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
      privacy: {
        title: 'Privacy',
        content:
          'Game saves are stored locally in your browser. No tracking cookies are used. Audio preferences remain local.',
      },
    },
  },
  it: {
    title: 'Info e Impostazioni',
    search: 'Cerca...',
    sections: {
      rules: {
        title: 'Regole',
        content:
          'Ogni giocatore schiera gli eserciti, attacca territori adiacenti e termina il turno. Chi conquista tutte le terre vince.',
      },
      tips: {
        title: 'Suggerimenti',
        content: 'Espandi all\'inizio, difendi i confini e osserva gli avversari.',
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
      privacy: {
        title: 'Privacy',
        content:
          'I salvataggi sono memorizzati localmente nel browser. Nessun cookie di tracciamento viene utilizzato. Le preferenze audio restano locali.',
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
  const searchInput = doc.getElementById('helpSearch');
  searchInput.placeholder = t.search;
  searchInput.addEventListener('input', (e) => filterSections(e.target.value, doc));
  Object.entries(t.sections).forEach(([id, data]) => {
    const section = doc.getElementById(id);
    if (!section) return;
    section.querySelector('h2').textContent = data.title;
    section.querySelector('.content').innerHTML = data.content;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => initAbout());
}

export default { initAbout, filterSections };
