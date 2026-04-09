import { t, translateServerMessage } from "./i18n.mjs";

const state = {
  ruleSets: [],
  maps: [],
  diceRuleSets: [],
  user: null,
  creating: false,
  sessionReady: false
};

const elements = {
  authStatus: document.querySelector("#setup-auth-status"),
  feedback: document.querySelector("#new-game-feedback"),
  form: document.querySelector("#new-game-form"),
  gameName: document.querySelector("#setup-game-name"),
  headerLoginForm: document.querySelector("#header-login-form"),
  headerAuthUsername: document.querySelector("#header-auth-username"),
  headerAuthPassword: document.querySelector("#header-auth-password"),
  headerLoginButton: document.querySelector("#header-login-button"),
  logoutButton: document.querySelector("#logout-button"),
  ruleSet: document.querySelector("#setup-ruleset"),
  ruleSetSummary: document.querySelector("#setup-ruleset-summary"),
  map: document.querySelector("#setup-map"),
  mapDetails: document.querySelector("#setup-map-details"),
  customizeOptions: document.querySelector("#setup-customize-options"),
  advancedOptions: document.querySelector("#setup-advanced-options"),
  diceRuleSet: document.querySelector("#setup-dice-ruleset"),
  playerSlots: document.querySelector("#setup-player-slots"),
  submit: document.querySelector("#submit-new-game"),
  totalPlayers: document.querySelector("#setup-total-players")
};

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function slotDescription(type, index) {
  if (index === 0) {
    return t("newGame.slot.locked");
  }

  return type === "ai"
    ? t("newGame.slot.aiDescription")
    : t("newGame.slot.humanDescription");
}

function slotMarkup(index) {
  if (index === 0) {
    return '<div class="setup-slot is-fixed" data-slot-index="0">' +
      '<div class="setup-slot-head"><strong>' + t("newGame.slot.playerLabel", { number: index + 1 }) + '</strong><span class="badge accent">' + t("newGame.slot.creatorBadge") + '</span></div>' +
      '<div class="field-stack"><span>' + t("newGame.slot.typeLabel") + '</span><div class="setup-fixed-value">' + t("newGame.slot.humanOption") + '</div></div>' +
      '<p class="setup-slot-note" data-role="note">' + slotDescription("human", 0) + '</p>' +
    '</div>';
  }

  return '<div class="setup-slot" data-slot-index="' + index + '">' +
    '<div class="setup-slot-head"><strong>' + t("newGame.slot.playerLabel", { number: index + 1 }) + '</strong></div>' +
    '<label class="field-stack"><span>' + t("newGame.slot.typeLabel") + '</span><select data-role="type"><option value="human">' + t("newGame.slot.humanOption") + '</option><option value="ai">' + t("newGame.slot.aiOption") + '</option></select></label>' +
    '<p class="setup-slot-note" data-role="note">' + slotDescription("human", index) + '</p>' +
  '</div>';
}

function updateSlotNotes() {
  Array.from(elements.playerSlots.querySelectorAll("[data-slot-index]")).forEach((slot, index) => {
    const typeControl = slot.querySelector('[data-role="type"]');
    const type = typeControl ? typeControl.value : "human";
    slot.querySelector('[data-role="note"]').textContent = slotDescription(type, index);
  });
}

function renderSlots() {
  const total = Number(elements.totalPlayers.value || 2);
  elements.playerSlots.innerHTML = Array.from({ length: total }, (_, index) => slotMarkup(index)).join("");
  updateSlotNotes();
}

function setFeedback(message, type = "") {
  elements.feedback.className = "session-feedback" + (type === "error" ? " is-error" : "") + (message ? "" : " is-hidden");
  elements.feedback.textContent = message || "";
}

function updateSubmitState() {
  elements.submit.disabled = state.creating || !state.sessionReady || !state.user;
}

function selectedMapSummary() {
  return state.maps.find((map) => map.id === elements.map.value) || null;
}

function selectedRuleSet() {
  return state.ruleSets.find((ruleSet) => ruleSet.id === elements.ruleSet.value) || null;
}

function selectedDiceRuleSet() {
  return state.diceRuleSets.find((ruleSet) => ruleSet.id === elements.diceRuleSet.value) || null;
}

function diceRuleSetLabel(ruleSet) {
  if (!ruleSet) {
    return t("common.notAvailable");
  }

  return ruleSet.name + " (" + ruleSet.attackerMaxDice + "/" + ruleSet.defenderMaxDice + ")";
}

function syncRuleSetDefaults() {
  const ruleSet = selectedRuleSet();
  if (!ruleSet) {
    return;
  }

  elements.diceRuleSet.value = ruleSet.defaultDiceRuleSetId;
}

function renderRuleSetSummary() {
  const ruleSet = selectedRuleSet();
  if (!ruleSet) {
    elements.ruleSetSummary.innerHTML = "";
    return;
  }

  const activeDiceRuleSet = elements.customizeOptions.checked
    ? selectedDiceRuleSet()
    : state.diceRuleSets.find((entry) => entry.id === ruleSet.defaultDiceRuleSetId) || null;

  elements.ruleSetSummary.innerHTML =
    '<div class="map-setup-card-head">' +
      '<strong>' + ruleSet.name + '</strong>' +
      '<span class="badge">' + diceRuleSetLabel(activeDiceRuleSet) + '</span>' +
    '</div>' +
    '<p class="map-setup-copy">' +
      t(
        elements.customizeOptions.checked
          ? "newGame.ruleset.summary.custom"
          : "newGame.ruleset.summary.default",
        {
          ruleset: ruleSet.name,
          dice: diceRuleSetLabel(activeDiceRuleSet)
        }
      ) +
    '</p>';
}

function renderAdvancedOptions() {
  elements.advancedOptions.hidden = !elements.customizeOptions.checked;
  renderRuleSetSummary();
}

function renderMapDetails() {
  const map = selectedMapSummary();
  if (!map) {
    elements.mapDetails.innerHTML = "";
    return;
  }

  const bonuses = Array.isArray(map.continentBonuses) ? map.continentBonuses : [];
  const bonusMarkup = bonuses.map((continent) =>
    '<li><span>' + continent.name + '</span><strong>' + t("newGame.map.bonusLine", { bonus: continent.bonus, territoryCount: continent.territoryCount }) + '</strong></li>'
  ).join("");

  elements.mapDetails.innerHTML =
    '<div class="map-setup-card-head">' +
      '<strong>' + map.name + '</strong>' +
      '<span class="badge">'
        + t("newGame.map.summary", { territoryCount: map.territoryCount, continentCount: map.continentCount }) +
      '</span>' +
    '</div>' +
    '<p class="map-setup-copy">' + t("newGame.map.copy") + '</p>' +
    '<ul class="map-setup-bonus-list">' + bonusMarkup + '</ul>';
}

function readConfig() {
  const totalPlayers = Number(elements.totalPlayers.value || 2);
  const players = Array.from(elements.playerSlots.querySelectorAll("[data-slot-index]"))
    .map((slot, index) => ({
      type: index === 0 ? "human" : slot.querySelector('[data-role="type"]').value,
      slot: index + 1
    }));

  return {
    name: elements.gameName.value.trim() || undefined,
    ruleSetId: elements.ruleSet.value,
    mapId: elements.map.value,
    ...(elements.customizeOptions.checked ? { diceRuleSetId: elements.diceRuleSet.value } : {}),
    totalPlayers,
    players
  };
}

async function send(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.requestFailed")));
  }
  return data;
}

async function loadOptions() {
  const response = await fetch("/api/game-options");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("newGame.errors.loadOptions")));
  }

  state.maps = data.maps || [];
  state.ruleSets = data.ruleSets || [];
  state.diceRuleSets = data.diceRuleSets || [];
  elements.ruleSet.innerHTML = state.ruleSets.map((ruleSet) => '<option value="' + ruleSet.id + '">' + ruleSet.name + '</option>').join("");
  elements.map.innerHTML = state.maps.map((map) => '<option value="' + map.id + '">' + map.name + '</option>').join("");
  elements.diceRuleSet.innerHTML = state.diceRuleSets.map((ruleSet) => '<option value="' + ruleSet.id + '">' + diceRuleSetLabel(ruleSet) + '</option>').join("");
  syncRuleSetDefaults();
  renderRuleSetSummary();
  renderMapDetails();
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");

    if (!response.ok) {
      throw new Error(t("auth.sessionExpired"));
    }

    const data = await response.json();
    state.user = data.user;
  } catch (error) {
    state.user = null;
  }

  elements.logoutButton.hidden = !state.user;
  if (elements.headerLoginForm) {
    const isAuthenticated = Boolean(state.user);
    elements.headerLoginForm.hidden = isAuthenticated;
    elements.headerAuthUsername.disabled = isAuthenticated;
    elements.headerAuthPassword.disabled = isAuthenticated;
    elements.headerLoginButton.disabled = isAuthenticated;
  }
  elements.authStatus.textContent = state.user
    ? t("newGame.auth.commander", { username: state.user.username })
    : t("newGame.authStatus");
  renderNavAvatar(state.user && state.user.username);
  state.sessionReady = true;
  updateSubmitState();
}

async function loginWithCredentials(username, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.loginFailed")));
  }

  state.user = data.user;
  elements.headerAuthPassword.value = "";
  await restoreSession();
}

elements.totalPlayers.addEventListener("change", renderSlots);
elements.ruleSet.addEventListener("change", () => {
  syncRuleSetDefaults();
  renderRuleSetSummary();
});
elements.map.addEventListener("change", renderMapDetails);
elements.customizeOptions.addEventListener("change", renderAdvancedOptions);
elements.diceRuleSet.addEventListener("change", renderRuleSetSummary);
elements.playerSlots.addEventListener("change", (event) => {
  if (!event.target.matches('[data-role="type"]')) {
    return;
  }
  updateSlotNotes();
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.creating || !state.sessionReady) {
    return;
  }
  if (!state.user) {
    setFeedback(t("newGame.errors.invalidSession"), "error");
    return;
  }

  state.creating = true;
  updateSubmitState();
  setFeedback(t("newGame.feedback.creating"));

  try {
    const data = await send("/api/games", readConfig());
    if (data.playerId) {
      localStorage.setItem("frontline-player-id", data.playerId);
    } else {
      localStorage.removeItem("frontline-player-id");
    }
    window.location.href = "/game.html?gameId=" + encodeURIComponent(data.game.id);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    state.creating = false;
    updateSubmitState();
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", {});
  } catch (error) {
  }

  state.user = null;
  state.sessionReady = true;
  elements.logoutButton.hidden = true;
  elements.authStatus.textContent = t("newGame.authStatus");
  renderNavAvatar();
  updateSubmitState();
});

if (elements.headerLoginForm) {
  elements.headerLoginForm.dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername.value.trim();
    const password = elements.headerAuthPassword.value;
    if (!username || !password) {
      return;
    }

    try {
      await loginWithCredentials(username, password);
    } catch (error) {
      setFeedback(error.message, "error");
    }
  });
}

await loadOptions();
renderSlots();
renderAdvancedOptions();
updateSubmitState();
await restoreSession();
