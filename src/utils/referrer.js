export function getSafeReferrer() {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const url = new URL(ref, window.location.href);
    if (url.origin === window.location.origin) {
      return url.href;
    }
  } catch {
    // ignore invalid referrers
  }
  return null;
}
