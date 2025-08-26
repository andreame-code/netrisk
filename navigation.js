export function navigateTo(url, win = typeof window !== "undefined" ? window : undefined) {
  if (win) {
    if (typeof win.location.assign === "function") {
      win.location.assign(url);
    } else {
      win.location.href = url;
    }
  }
}

export function goHome(win = typeof window !== "undefined" ? window : undefined) {
  navigateTo("index.html", win);
}

export function exitGame(win = typeof window !== "undefined" ? window : undefined) {
  goHome(win);
}

export default { navigateTo, goHome, exitGame };
