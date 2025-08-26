const steps = [
  { selector: '#editorCanvas', text: 'Drag territories to position them.' },
  {
    selector: '#continentList',
    text: 'Assign territories to continents and set bonuses.',
  },
];

let index = 0;
let overlay = null;

function showStep() {
  const step = steps[index];
  if (!step) {
    finish();
    return;
  }
  overlay.innerHTML = '';
  const target = document.querySelector(step.selector);
  const box = document.createElement('div');
  box.style.position = 'absolute';
  const rect = target ? target.getBoundingClientRect() : { bottom: 0, left: 0 };
  box.style.top = `${rect.bottom + 10}px`;
  box.style.left = `${rect.left}px`;
  box.style.background = '#fff';
  box.style.color = '#000';
  box.style.padding = '10px';
  box.style.borderRadius = '4px';
  box.style.zIndex = '2001';
  box.innerHTML = `<p>${step.text}</p>`;
  const next = document.createElement('button');
  next.textContent = 'Next';
  next.className = 'btn';
  next.addEventListener('click', () => {
    index += 1;
    showStep();
  });
  box.appendChild(next);
  overlay.appendChild(box);
}

function finish() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export function startEditorTutorial() {
  index = 0;
  overlay = document.createElement('div');
  overlay.id = 'editorTutorialOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.zIndex = '2000';
  document.body.appendChild(overlay);
  showStep();
}

export function initEditorTutorial() {
  const btn = document.getElementById('playEditorTutorial');
  if (btn) {
    btn.addEventListener('click', startEditorTutorial);
  }
}
