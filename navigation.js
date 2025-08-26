export function navigateTo(
  url,
  win = typeof window !== "undefined" ? window : undefined,
) {
  if (!win) return;
  if (win.history && typeof win.history.pushState === "function") {
    try {
      win.history.pushState({}, "", url);
    } catch {
      /* ignore history errors */
    }
  }
  if (typeof win.location.assign === "function") {
    win.location.assign(url);
  } else if (win.location) {
    win.location.href = url;
  }
}

export function goHome(win = typeof window !== "undefined" ? window : undefined) {
  navigateTo("index.html", win);
}

export function exitGame(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return;
  if (!win.confirm || win.confirm("Exit the game and return to home?")) {
    navigateTo("index.html", win);
  }
}

export default { navigateTo, goHome, exitGame };
