export function navigateTo(url) {
  if (typeof window !== "undefined") {
    if (typeof window.location.assign === "function") {
      window.location.assign(url);
    } else {
      window.location.href = url;
    }
  }
}

export default { navigateTo };
