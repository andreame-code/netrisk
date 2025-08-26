import { initThemeToggle } from "./theme.js";
import { navigateTo } from "./navigation.js";

export function initHome() {
  initThemeToggle();
  const mapping = [
    ["playBtn", "game.html"],
    ["setupBtn", "setup.html"],
    ["howToPlayBtn", "how-to-play.html"],
    ["aboutBtn", "about.html"],
  ];
  mapping.forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => navigateTo(url));
    }
  });
}

initHome();

export default { initHome };
