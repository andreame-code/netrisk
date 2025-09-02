import { initThemeToggle } from './theme.js';
import { navigateTo } from './navigation.js';
import { createAuthAdapter } from './infra/supabase/auth.adapter.ts';

export function initHome({ authPort }) {
  initThemeToggle();
  const mapping = [
    ['playBtn', './game.html'],
    ['setupBtn', './setup.html'],
    ['howToPlayBtn', './how-to-play.html'],
    ['aboutBtn', './about.html'],
  ];
  mapping.forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => navigateTo(url));
    }
  });

  const multiBtn = document.getElementById('multiplayerBtn');
  if (multiBtn) {
    multiBtn.addEventListener('click', async () => {
      let user = null;
      try {
        user = await authPort.currentUser({});
      } catch {
        user = null;
      }
      if (user) {
        navigateTo('./lobby.html');
        return;
      }
      const dialog = document.createElement('dialog');
      dialog.innerHTML = `
        <p>Serve un account per giocare online</p>
        <div>
          <button id="loginDialogBtn">Accedi</button>
          <button id="registerDialogBtn">Registrati</button>
        </div>
      `;
      document.body.appendChild(dialog);
      dialog
        .querySelector('#loginDialogBtn')
        ?.addEventListener('click', () => navigateTo('login.html?redirect=lobby.html'));
      dialog
        .querySelector('#registerDialogBtn')
        ?.addEventListener('click', () => navigateTo('register.html?redirect=lobby.html'));
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }
}

const authPort = createAuthAdapter();
initHome({ authPort });

export default { initHome };
