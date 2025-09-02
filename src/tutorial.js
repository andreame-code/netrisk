// Simple step-by-step tutorial overlay

const lang = navigator.language && navigator.language.startsWith('it') ? 'it' : 'en';

const i18n = {
  en: {
    steps: [
      'This is the map where you deploy armies and attack opponents.',
      'Use this panel to choose your actions.',
      'All game events appear in this log.',
      'End your turn using this button.',
    ],
    next: 'Next',
    skip: 'Skip',
    prompt: 'Tutorial complete! Start a real game?',
  },
  it: {
    steps: [
      'Questa è la mappa dove schieri gli eserciti e attacchi gli avversari.',
      'Usa questo pannello per scegliere le azioni.',
      'Tutti gli eventi di gioco appaiono in questo log.',
      'Termina il tuo turno con questo pulsante.',
    ],
    next: 'Avanti',
    skip: 'Salta',
    prompt: 'Tutorial completato! Iniziare una partita reale?',
  },
};

function t(key) {
  return i18n[lang][key];
}

const steps = [
  { selector: '#board' },
  { selector: '#uiPanel' },
  { selector: '#actionLog' },
  { selector: '#endTurn' },
];

let stepIndex = 0;

function track(event, detail) {
  // placeholder analytics tracking
  console.log('analytics', event, detail);
}

function highlightElement(el) {
  const highlight = document.createElement('div');
  highlight.id = 'tutorialHighlight';
  const rect = el.getBoundingClientRect();
  highlight.style.position = 'absolute';
  highlight.style.top = rect.top + 'px';
  highlight.style.left = rect.left + 'px';
  highlight.style.width = rect.width + 'px';
  highlight.style.height = rect.height + 'px';
  highlight.style.border = '3px solid yellow';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '2002';
  return highlight;
}

function showStep() {
  const step = steps[stepIndex];
  if (!step) return finishTutorial();
  track('tutorial_step', stepIndex);
  const overlay = document.getElementById('tutorialOverlay');
  overlay.innerHTML = '';
  const target = document.querySelector(step.selector);
  if (target) {
    overlay.appendChild(highlightElement(target));
    const rect = target.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.top = rect.bottom + 10 + 'px';
    box.style.left = rect.left + 'px';
    box.style.background = '#fff';
    box.style.color = '#000';
    box.style.padding = '10px';
    box.style.borderRadius = '4px';
    box.style.zIndex = '2003';
    box.style.pointerEvents = 'auto';
    box.innerHTML = `<p>${t('steps')[stepIndex]}</p>`;
    const nextBtn = document.createElement('button');
    nextBtn.textContent = t('next');
    nextBtn.className = 'btn';
    nextBtn.addEventListener('click', () => {
      stepIndex += 1;
      if (stepIndex >= steps.length) {
        finishTutorial();
      } else {
        showStep();
      }
    });
    const skipBtn = document.createElement('button');
    skipBtn.textContent = t('skip');
    skipBtn.className = 'btn';
    skipBtn.style.marginLeft = '10px';
    skipBtn.addEventListener('click', finishTutorial);
    box.appendChild(nextBtn);
    box.appendChild(skipBtn);
    overlay.appendChild(box);
    const boxRect = box.getBoundingClientRect();
    if (boxRect.right > window.innerWidth) {
      box.style.left = Math.max(10, window.innerWidth - boxRect.width - 10) + 'px';
    }
    if (boxRect.bottom > window.innerHeight) {
      box.style.top = Math.max(10, rect.top - boxRect.height - 10) + 'px';
    }
  } else {
    finishTutorial();
  }
}

function finishTutorial() {
  track('tutorial_complete');
  localStorage.setItem('tutorialCompleted', 'true');
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.remove();
  if (window.confirm(t('prompt'))) {
    const startBtn = document.getElementById('startGame');
    if (startBtn) startBtn.click();
  }
}

export function startTutorial() {
  stepIndex = 0;
  track('tutorial_start');
  const overlay = document.createElement('div');
  overlay.id = 'tutorialOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.zIndex = '2001';
  overlay.style.pointerEvents = 'none';
  document.body.appendChild(overlay);
  showStep();
}

export function initTutorialButtons() {
  const btn = document.getElementById('playTutorial');
  if (btn) {
    if (localStorage.getItem('tutorialCompleted') === 'true') {
      btn.classList.add('hidden');
    }
    btn.addEventListener('click', () => {
      startTutorial();
    });
  }
  const replay = document.getElementById('replayTutorial');
  if (replay) {
    replay.addEventListener('click', startTutorial);
  }
}
