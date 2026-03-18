const section = document.body.dataset.appSection || "";
const query = new URLSearchParams(window.location.search);
const currentGameId = query.get("gameId");

document.querySelectorAll("[data-nav-section]").forEach((link) => {
  const isActive = link.dataset.navSection === section;
  link.classList.toggle("is-active", isActive);
  link.setAttribute("aria-current", isActive ? "page" : "false");

  if (link.dataset.navSection === "game" && currentGameId) {
    link.href = "/game.html?gameId=" + encodeURIComponent(currentGameId);
  }
});
