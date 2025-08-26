export function navigateTo(url, win = typeof window !== "undefined" ? window : undefined) {
  if (win) {
    if (typeof win.location.assign === "function") {
      win.location.assign(url);
    } else {
      win.location.href = url;
    }
  }
}

export default { navigateTo };
