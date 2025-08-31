import { initThemeToggle } from "./theme.js";
import { navigateTo } from "./navigation.js";
import supabase from "./init/supabase-client.js";

export function initHome() {
  initThemeToggle();
  const mapping = [
    ["playBtn", "./game.html"],
    ["setupBtn", "./setup.html"],
    ["howToPlayBtn", "./how-to-play.html"],
    ["aboutBtn", "./about.html"],
  ];
  mapping.forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => navigateTo(url));
    }
  });

  const multiBtn = document.getElementById("multiplayerBtn");
  if (multiBtn) {
    multiBtn.addEventListener("click", async () => {
      let user = null;
      try {
        ({ data: { user } = {} } = (await supabase.auth.getUser()));
      } catch {
        user = null;
      }
      if (user) {
        navigateTo("./lobby.html");
        return;
      }
      const dialog = document.createElement("dialog");
      dialog.innerHTML = `
        <p>Serve un account per giocare online</p>
        <div>
          <button id="loginDialogBtn">Accedi</button>
          <button id="registerDialogBtn">Registrati</button>
        </div>
      `;
      document.body.appendChild(dialog);
      dialog.querySelector("#loginDialogBtn")?.addEventListener("click", () =>
        navigateTo("login.html?redirect=lobby.html")
      );
      dialog.querySelector("#registerDialogBtn")?.addEventListener("click", () =>
        navigateTo("register.html?redirect=lobby.html")
      );
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    });
  }
}

initHome();

export default { initHome };
