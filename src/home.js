import { initThemeToggle } from './theme.js';
import { navigateTo } from './navigation.js';

export function initHome() {
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
    multiBtn.addEventListener('click', () => navigateTo('./lobby.html'));
  }
}

initHome();

export default { initHome };
