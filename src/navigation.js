export function navigateTo(url, win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return;
  const path = win.location?.pathname ?? '';
  const base = !path
    ? ''
    : path.endsWith('/')
      ? path
      : !path.includes('.') && path.split('/').filter(Boolean).length === 1
        ? `${path}/`
        : path.replace(/[^/]*$/, '');
  const isAbsolute = /^(?:[a-z]+:)?\//i.test(url);
  const target = isAbsolute ? url : base + url.replace(/^\.\//, '');
  if (win.history && typeof win.history.pushState === 'function') {
    try {
      win.history.pushState({}, '', target);
    } catch {
      // ignore history errors
    }
  }
  if (typeof win.location.assign === 'function') {
    win.location.assign(target);
  } else {
    win.location.href = target;
  }
}

export function goHome(win = typeof window !== 'undefined' ? window : undefined) {
  navigateTo('index.html', win);
}

export function exitGame(
  win = typeof window !== 'undefined' ? window : undefined,
  message = 'Exit the game and return to home?',
) {
  if (!win) return;
  const confirmed = typeof win.confirm === 'function' ? win.confirm(message) : true;
  if (confirmed) {
    goHome(win);
  }
}

export default { navigateTo, goHome, exitGame };
