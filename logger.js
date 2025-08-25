(function () {
  const overlay = document.createElement("div");
  overlay.id = "error-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    background: "rgba(255,0,0,0.9)",
    color: "#fff",
    padding: "4px",
    display: "none",
    zIndex: "1000",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(overlay);
  });

  function showError(message) {
    overlay.textContent = message;
    overlay.style.display = "block";
  }

  window.logger = {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
  };

  window.onerror = function (msg) {
    window.logger.error(msg);
    showError(msg);
  };

  window.onunhandledrejection = function (event) {
    const msg =
      event.reason && event.reason.message
        ? event.reason.message
        : String(event.reason);
    window.logger.error(msg);
    showError(msg);
  };
})();
