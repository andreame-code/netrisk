const state = {
  playerId: localStorage.getItem("frontline-player-id") || null,
  playerName: localStorage.getItem("frontline-player-name") || "",
  snapshot: null
};

const elements = {
  joinForm: document.querySelector("#join-form"),
  playerName: document.querySelector("#player-name"),
  identityStatus: document.querySelector("#identity-status"),
  startButton: document.querySelector("#start-button"),
  turnBadge: document.querySelector("#turn-badge"),
  statusSummary: document.querySelector("#status-summary"),
  players: document.querySelector("#players"),
  map: document.querySelector("#map"),
  reinforceSelect: document.querySelector("#reinforce-select"),
  reinforceButton: document.querySelector("#reinforce-button"),
  attackFrom: document.querySelector("#attack-from"),
  attackTo: document.querySelector("#attack-to"),
  attackButton: document.querySelector("#attack-button"),
  actionHint: document.querySelector("#action-hint"),
  endTurnButton: document.querySelector("#end-turn-button"),
  log: document.querySelector("#log")
};

elements.playerName.value = state.playerName;

function ownerById(ownerId) {
  return state.snapshot?.players.find((player) => player.id === ownerId) || null;
}

function isCurrentPlayer() {
  return state.snapshot?.currentPlayerId === state.playerId;
}

function myTerritories() {
  return (state.snapshot?.map || []).filter((territory) => territory.ownerId === state.playerId);
}

function setIdentity(playerId, playerName) {
  state.playerId = playerId;
  state.playerName = playerName;
  localStorage.setItem("frontline-player-id", playerId);
  localStorage.setItem("frontline-player-name", playerName);
}

function render() {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return;
  }

  const currentPlayer = snapshot.players.find((player) => player.id === snapshot.currentPlayerId);
  const me = snapshot.players.find((player) => player.id === state.playerId);
  elements.identityStatus.textContent = me
    ? `Connesso come ${me.name}. Apri questa pagina anche da altri browser per simulare altri giocatori.`
    : "Scegli un nome e collegati alla lobby.";

  elements.turnBadge.textContent =
    snapshot.phase === "lobby"
      ? "Lobby"
      : snapshot.phase === "finished"
        ? "Partita conclusa"
        : currentPlayer
          ? `Turno di ${currentPlayer.name}`
          : "In attesa";

  const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
  elements.statusSummary.innerHTML = `
    <div>Fase: <strong>${snapshot.phase}</strong></div>
    <div>Rinforzi disponibili: <strong>${snapshot.reinforcementPool}</strong></div>
    <div>Vincitore: <strong>${winner ? winner.name : "nessuno"}</strong></div>
  `;

  elements.players.innerHTML = snapshot.players
    .map(
      (player) => `
        <article class="player-card">
          <strong>${player.name}</strong>
          <div>Territori: ${player.territoryCount}</div>
          <div>Stato: ${player.eliminated ? "eliminato" : "attivo"}</div>
          <div style="margin-top: 8px; height: 10px; border-radius: 99px; background: ${player.color};"></div>
        </article>
      `
    )
    .join("");

  elements.map.innerHTML = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      return `
        <article class="territory-card" style="--owner-color: ${owner?.color || "#adb5bd"}">
          <strong>${territory.name}</strong>
          <div>Armate: ${territory.armies}</div>
          <div>Controllo: ${owner ? owner.name : "neutrale"}</div>
          <div>Confini: ${territory.neighbors.join(", ")}</div>
        </article>
      `;
    })
    .join("");

  const territories = myTerritories();
  const reinforceOptions = territories
    .map((territory) => `<option value="${territory.id}">${territory.name} (${territory.armies})</option>`)
    .join("");
  elements.reinforceSelect.innerHTML = reinforceOptions || '<option value="">Nessun territorio</option>';
  elements.attackFrom.innerHTML = reinforceOptions || '<option value="">Nessun territorio</option>';

  const selectedFromId = elements.attackFrom.value || territories[0]?.id || "";
  const source = snapshot.map.find((territory) => territory.id === selectedFromId);
  const attackTargets = snapshot.map.filter(
    (territory) =>
      source?.neighbors.includes(territory.id) &&
      territory.ownerId &&
      territory.ownerId !== state.playerId
  );

  elements.attackTo.innerHTML =
    attackTargets
      .map((territory) => {
        const owner = ownerById(territory.ownerId);
        return `<option value="${territory.id}">${territory.name} vs ${owner?.name || "?"} (${territory.armies})</option>`;
      })
      .join("") || '<option value="">Nessun bersaglio</option>';

  const canInteract = Boolean(me) && snapshot.phase === "active" && isCurrentPlayer();
  elements.startButton.disabled = !me || snapshot.phase !== "lobby" || snapshot.players.length < 2;
  elements.reinforceButton.disabled =
    !canInteract || snapshot.reinforcementPool <= 0 || !elements.reinforceSelect.value;
  elements.attackButton.disabled =
    !canInteract || snapshot.reinforcementPool > 0 || !elements.attackFrom.value || !elements.attackTo.value;
  elements.endTurnButton.disabled = !canInteract || snapshot.reinforcementPool > 0;
  elements.actionHint.textContent = canInteract
    ? snapshot.reinforcementPool > 0
      ? "Distribuisci rinforzi"
      : "Puoi attaccare o chiudere il turno"
    : "Osservazione";

  elements.log.innerHTML = snapshot.log.map((entry) => `<li>${entry}</li>`).join("");
}

async function send(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Richiesta fallita.");
  }
  return data;
}

async function loadState() {
  const response = await fetch("/api/state");
  state.snapshot = await response.json();
  render();
}

function connectEvents() {
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state.snapshot = JSON.parse(event.data);
    render();
  };
}

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.playerName.value.trim();
  if (!name) {
    return;
  }

  try {
    const data = await send("/api/join", { name });
    setIdentity(data.playerId, name);
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.startButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/start", { playerId: state.playerId });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.reinforceButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      playerId: state.playerId,
      type: "reinforce",
      territoryId: elements.reinforceSelect.value
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.attackFrom.addEventListener("change", () => render());

elements.attackButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      playerId: state.playerId,
      type: "attack",
      fromId: elements.attackFrom.value,
      toId: elements.attackTo.value
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.endTurnButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      playerId: state.playerId,
      type: "endTurn"
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

await loadState();
connectEvents();
