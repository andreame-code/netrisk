export function applyColorTheme(doc = document) {
  const body = doc.body;
  if (!body) return;
  const stored =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("colorTheme")) ||
    "light";
  body.classList.toggle("dark-theme", stored === "dark");
}

export function initThemeToggle(doc = document) {
  const body = doc.body;
  if (!body) return;
  applyColorTheme(doc);
  const btn = doc.getElementById("themeToggle");
  const stored =
    (typeof localStorage !== "undefined" && localStorage.getItem("theme")) ||
    "default";
  if (stored === "high-contrast") {
    body.classList.add("high-contrast");
    if (btn) btn.textContent = "Standard Theme";
  }
  if (!btn) return;
  btn.addEventListener("click", () => {
    body.classList.toggle("high-contrast");
    const high = body.classList.contains("high-contrast");
    btn.textContent = high ? "Standard Theme" : "High Contrast";
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("theme", high ? "high-contrast" : "default");
      } catch (err) {
        // ignore storage errors
      }
    }
  });
}

export function initThemeSelect(doc = document) {
  const body = doc.body;
  if (!body) return;
  const sel = doc.getElementById("themeSelect");
  if (!sel) return;
  const stored =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("colorTheme")) ||
    "light";
  sel.value = stored;
  if (stored === "dark") body.classList.add("dark-theme");
  sel.addEventListener("change", (e) => {
    const val = e.target.value;
    body.classList.toggle("dark-theme", val === "dark");
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("colorTheme", val);
      } catch (err) {
        // ignore storage errors
      }
    }
  });
}
