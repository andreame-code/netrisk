export function navigateTo(url, win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return;
  if (win.history && typeof win.history.pushState === "function") {
    try {
      win.history.pushState({}, "", url);
    } catch {
      // ignore history errors
    }
  }
  if (typeof win.location.assign === "function") {
    win.location.assign(url);
  } else {
    win.location.href = url;
  }
}

export function goHome(win = typeof window !== "undefined" ? window : undefined) {
  navigateTo("index.html", win);
}

export function exitGame(
  win = typeof window !== "undefined" ? window : undefined,
  message = "Exit the game and return to home?",
) {
  if (!win) return;
  const confirmed = typeof win.confirm === "function" ? win.confirm(message) : true;
  if (confirmed) {
    goHome(win);
  }
}

export default { navigateTo, goHome, exitGame };
