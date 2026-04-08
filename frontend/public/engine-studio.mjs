import { createMapBuilder } from "./engine-map-builder.mjs";

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function parseJsonField(value, fallbackValue) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallbackValue;
  }

  return JSON.parse(raw);
}

const state = {
  maps: [],
  pieceThemes: [],
  victoryRules: [],
  combatRules: [],
  gameRulesets: [],
  modules: {
    victory: [],
    ruleModifiers: []
  },
  selected: {
    map: null,
    pieceTheme: null,
    victoryRule: null,
    gameRuleset: null
  }
};

const elements = {
  feedback: document.querySelector("#engine-feedback"),
  mapSelect: document.querySelector("#engine-map-select"),
  mapName: document.querySelector("#engine-map-name"),
  mapBackground: document.querySelector("#engine-map-background"),
  mapAspectWidth: document.querySelector("#engine-map-aspect-width"),
  mapAspectHeight: document.querySelector("#engine-map-aspect-height"),
  mapTerritories: document.querySelector("#engine-map-territories"),
  mapContinents: document.querySelector("#engine-map-continents"),
  mapPositions: document.querySelector("#engine-map-positions"),
  mapBoard: document.querySelector("#engine-map-board"),
  mapLinks: document.querySelector("#engine-map-links"),
  mapNodes: document.querySelector("#engine-map-nodes"),
  mapAddTerritory: document.querySelector("#engine-map-add-territory"),
  mapTerritoryList: document.querySelector("#engine-map-territory-list"),
  mapRemoveTerritory: document.querySelector("#engine-map-remove-territory"),
  territoryId: document.querySelector("#engine-territory-id"),
  territoryName: document.querySelector("#engine-territory-name"),
  territoryContinent: document.querySelector("#engine-territory-continent"),
  territoryNeighbors: document.querySelector("#engine-territory-neighbors"),
  mapAddContinent: document.querySelector("#engine-map-add-continent"),
  mapContinentList: document.querySelector("#engine-map-continent-list"),
  mapRemoveContinent: document.querySelector("#engine-map-remove-continent"),
  continentId: document.querySelector("#engine-continent-id"),
  continentName: document.querySelector("#engine-continent-name"),
  continentBonus: document.querySelector("#engine-continent-bonus"),
  mapClear: document.querySelector("#engine-map-clear"),
  mapDelete: document.querySelector("#engine-map-delete"),
  mapSave: document.querySelector("#engine-map-save"),
  pieceSelect: document.querySelector("#engine-piece-select"),
  pieceName: document.querySelector("#engine-piece-name"),
  piecePalette: document.querySelector("#engine-piece-palette"),
  pieceIcon: document.querySelector("#engine-piece-icon"),
  pieceShape: document.querySelector("#engine-piece-shape"),
  pieceArmyLabel: document.querySelector("#engine-piece-army-label"),
  pieceClear: document.querySelector("#engine-piece-clear"),
  pieceDelete: document.querySelector("#engine-piece-delete"),
  pieceSave: document.querySelector("#engine-piece-save"),
  victorySelect: document.querySelector("#engine-victory-select"),
  victoryName: document.querySelector("#engine-victory-name"),
  victoryModule: document.querySelector("#engine-victory-module"),
  victoryDescription: document.querySelector("#engine-victory-description"),
  victoryConfig: document.querySelector("#engine-victory-config"),
  victoryClear: document.querySelector("#engine-victory-clear"),
  victoryDelete: document.querySelector("#engine-victory-delete"),
  victorySave: document.querySelector("#engine-victory-save"),
  rulesetSelect: document.querySelector("#engine-ruleset-select"),
  rulesetName: document.querySelector("#engine-ruleset-name"),
  rulesetDescription: document.querySelector("#engine-ruleset-description"),
  rulesetMap: document.querySelector("#engine-ruleset-map"),
  rulesetPieceTheme: document.querySelector("#engine-ruleset-piece-theme"),
  rulesetVictory: document.querySelector("#engine-ruleset-victory"),
  rulesetCombat: document.querySelector("#engine-ruleset-combat"),
  rulesetModifiers: document.querySelector("#engine-ruleset-modifiers"),
  rulesetClear: document.querySelector("#engine-ruleset-clear"),
  rulesetDelete: document.querySelector("#engine-ruleset-delete"),
  rulesetSave: document.querySelector("#engine-ruleset-save")
};

const mapBuilder = createMapBuilder({
  elements,
  onError(error) {
    setFeedback(error.message, "error");
  }
});

function setFeedback(message, type = "") {
  elements.feedback.className = "session-feedback" + (type === "error" ? " is-error" : "") + (message ? "" : " is-hidden");
  elements.feedback.textContent = message || "";
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Richiesta non riuscita.");
  }

  return data;
}

async function loadAll() {
  const [mapsData, pieceThemesData, victoryRulesData, rulesetsData, catalog] = await Promise.all([
    request("/api/engine/maps"),
    request("/api/engine/piece-themes"),
    request("/api/engine/victory-rules"),
    request("/api/engine/game-rulesets"),
    request("/api/engine/catalog")
  ]);

  state.maps = mapsData.maps || [];
  state.pieceThemes = pieceThemesData.pieceThemes || [];
  state.victoryRules = victoryRulesData.victoryRules || [];
  state.gameRulesets = rulesetsData.gameRulesets || [];
  state.combatRules = catalog.combatRules || [];
  state.modules = catalog.modules || { victory: [], ruleModifiers: [] };
  renderSelectors();
}

function optionMarkup(item) {
  return '<option value="' + item.id + '">' + item.name + (item.editable === false ? " (seed)" : "") + '</option>';
}

function renderSelectors() {
  elements.mapSelect.innerHTML = '<option value="">Nuova bozza</option>' + state.maps.map(optionMarkup).join("");
  elements.pieceSelect.innerHTML = '<option value="">Nuova bozza</option>' + state.pieceThemes.map(optionMarkup).join("");
  elements.victorySelect.innerHTML = '<option value="">Nuova bozza</option>' + state.victoryRules.map(optionMarkup).join("");
  elements.rulesetSelect.innerHTML = '<option value="">Nuova bozza</option>' + state.gameRulesets.map(optionMarkup).join("");
  elements.victoryModule.innerHTML = state.modules.victory.map(optionMarkup).join("");
  elements.rulesetMap.innerHTML = state.maps.map(optionMarkup).join("");
  elements.rulesetPieceTheme.innerHTML = state.pieceThemes.map(optionMarkup).join("");
  elements.rulesetVictory.innerHTML = state.victoryRules.map(optionMarkup).join("");
  elements.rulesetCombat.innerHTML = state.combatRules.map(optionMarkup).join("");
  elements.rulesetModifiers.innerHTML = (state.modules.ruleModifiers || []).map((modifier) =>
    '<label class="setup-slot">' +
      '<input type="checkbox" data-modifier-id="' + modifier.id + '" />' +
      '<strong>' + modifier.name + '</strong>' +
      '<p class="setup-slot-note">' + modifier.description + '</p>' +
    '</label>'
  ).join("");
}

function loadMapDraft(item) {
  state.selected.map = item || null;
  elements.mapName.value = item?.name || "";
  elements.mapBackground.value = item?.backgroundImage || "";
  elements.mapAspectWidth.value = item?.aspectRatio?.width || "";
  elements.mapAspectHeight.value = item?.aspectRatio?.height || "";
  mapBuilder.loadDraft(item);
}

function loadPieceDraft(item) {
  state.selected.pieceTheme = item || null;
  elements.pieceName.value = item?.name || "";
  elements.piecePalette.value = prettyJson(item?.palette || []);
  elements.pieceIcon.value = item?.icon || "";
  elements.pieceShape.value = item?.tokenShape || "";
  elements.pieceArmyLabel.value = item?.armyLabel || "";
}

function loadVictoryDraft(item) {
  state.selected.victoryRule = item || null;
  elements.victoryName.value = item?.name || "";
  elements.victoryModule.value = item?.moduleId || state.modules.victory[0]?.id || "";
  elements.victoryDescription.value = item?.description || "";
  elements.victoryConfig.value = prettyJson(item?.config || {});
}

function loadRulesetDraft(item) {
  state.selected.gameRuleset = item || null;
  elements.rulesetName.value = item?.name || "";
  elements.rulesetDescription.value = item?.description || "";
  elements.rulesetMap.value = item?.mapId || state.maps[0]?.id || "";
  elements.rulesetPieceTheme.value = item?.pieceThemeId || state.pieceThemes[0]?.id || "";
  elements.rulesetVictory.value = item?.victoryRuleId || state.victoryRules[0]?.id || "";
  elements.rulesetCombat.value = item?.combatRuleId || state.combatRules[0]?.id || "";
  const selectedIds = new Set(Array.isArray(item?.ruleModifierIds) ? item.ruleModifierIds : []);
  Array.from(elements.rulesetModifiers.querySelectorAll("[data-modifier-id]")).forEach((input) => {
    input.checked = selectedIds.has(input.dataset.modifierId);
  });
}

function collectCheckedModifierIds() {
  return Array.from(elements.rulesetModifiers.querySelectorAll("[data-modifier-id]"))
    .filter((input) => input.checked)
    .map((input) => input.dataset.modifierId);
}

async function saveMap() {
  const payload = mapBuilder.readPayload();

  const selected = state.selected.map;
  if (selected?.editable) {
    const response = await request("/api/engine/maps/" + encodeURIComponent(selected.id), { method: "PUT", body: payload });
    return response.map;
  } else {
    const response = await request("/api/engine/maps", { method: "POST", body: payload });
    return response.map;
  }
}

async function savePieceTheme() {
  const payload = {
    name: elements.pieceName.value.trim(),
    palette: parseJsonField(elements.piecePalette.value, []),
    icon: elements.pieceIcon.value.trim() || null,
    tokenShape: elements.pieceShape.value.trim() || "badge",
    armyLabel: elements.pieceArmyLabel.value.trim() || "Armies"
  };

  const selected = state.selected.pieceTheme;
  if (selected?.editable) {
    await request("/api/engine/piece-themes/" + encodeURIComponent(selected.id), { method: "PUT", body: payload });
  } else {
    await request("/api/engine/piece-themes", { method: "POST", body: payload });
  }
}

async function saveVictoryRule() {
  const payload = {
    name: elements.victoryName.value.trim(),
    moduleId: elements.victoryModule.value,
    description: elements.victoryDescription.value.trim(),
    config: parseJsonField(elements.victoryConfig.value, {})
  };

  const selected = state.selected.victoryRule;
  if (selected?.editable) {
    await request("/api/engine/victory-rules/" + encodeURIComponent(selected.id), { method: "PUT", body: payload });
  } else {
    await request("/api/engine/victory-rules", { method: "POST", body: payload });
  }
}

async function saveRuleset() {
  const payload = {
    name: elements.rulesetName.value.trim(),
    description: elements.rulesetDescription.value.trim(),
    mapId: elements.rulesetMap.value,
    pieceThemeId: elements.rulesetPieceTheme.value,
    victoryRuleId: elements.rulesetVictory.value,
    combatRuleId: elements.rulesetCombat.value,
    ruleModifierIds: collectCheckedModifierIds()
  };

  const selected = state.selected.gameRuleset;
  if (selected?.editable) {
    await request("/api/engine/game-rulesets/" + encodeURIComponent(selected.id), { method: "PUT", body: payload });
  } else {
    await request("/api/engine/game-rulesets", { method: "POST", body: payload });
  }
}

elements.mapSelect.addEventListener("change", () => {
  loadMapDraft(state.maps.find((item) => item.id === elements.mapSelect.value) || null);
});
elements.pieceSelect.addEventListener("change", () => {
  loadPieceDraft(state.pieceThemes.find((item) => item.id === elements.pieceSelect.value) || null);
});
elements.victorySelect.addEventListener("change", () => {
  loadVictoryDraft(state.victoryRules.find((item) => item.id === elements.victorySelect.value) || null);
});
elements.rulesetSelect.addEventListener("change", () => {
  loadRulesetDraft(state.gameRulesets.find((item) => item.id === elements.rulesetSelect.value) || null);
});

elements.mapClear.addEventListener("click", () => {
  elements.mapSelect.value = "";
  loadMapDraft(null);
});
elements.pieceClear.addEventListener("click", () => {
  elements.pieceSelect.value = "";
  loadPieceDraft(null);
});
elements.victoryClear.addEventListener("click", () => {
  elements.victorySelect.value = "";
  loadVictoryDraft(null);
});
elements.rulesetClear.addEventListener("click", () => {
  elements.rulesetSelect.value = "";
  loadRulesetDraft(null);
});

elements.mapDelete.addEventListener("click", async () => {
  if (!state.selected.map?.editable) {
    return;
  }
  try {
    await request("/api/engine/maps/" + encodeURIComponent(state.selected.map.id), { method: "DELETE" });
    setFeedback("Mappa custom eliminata.");
    await loadAll();
    loadMapDraft(null);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.pieceDelete.addEventListener("click", async () => {
  if (!state.selected.pieceTheme?.editable) {
    return;
  }
  try {
    await request("/api/engine/piece-themes/" + encodeURIComponent(state.selected.pieceTheme.id), { method: "DELETE" });
    setFeedback("Pedina custom eliminata.");
    await loadAll();
    loadPieceDraft(null);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.victoryDelete.addEventListener("click", async () => {
  if (!state.selected.victoryRule?.editable) {
    return;
  }
  try {
    await request("/api/engine/victory-rules/" + encodeURIComponent(state.selected.victoryRule.id), { method: "DELETE" });
    setFeedback("Regola vittoria custom eliminata.");
    await loadAll();
    loadVictoryDraft(null);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.rulesetDelete.addEventListener("click", async () => {
  if (!state.selected.gameRuleset?.editable) {
    return;
  }
  try {
    await request("/api/engine/game-rulesets/" + encodeURIComponent(state.selected.gameRuleset.id), { method: "DELETE" });
    setFeedback("Ruleset custom eliminato.");
    await loadAll();
    loadRulesetDraft(null);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.mapSave.addEventListener("click", async () => {
  try {
    const savedMap = await saveMap();
    setFeedback("Mappa salvata.");
    await loadAll();
    const refreshedMap = state.maps.find((item) => item.id === savedMap.id) || savedMap;
    elements.mapSelect.value = refreshedMap.id;
    loadMapDraft(refreshedMap);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.pieceSave.addEventListener("click", async () => {
  try {
    await savePieceTheme();
    setFeedback("Pedina salvata.");
    await loadAll();
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.victorySave.addEventListener("click", async () => {
  try {
    await saveVictoryRule();
    setFeedback("Regola vittoria salvata.");
    await loadAll();
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.rulesetSave.addEventListener("click", async () => {
  try {
    await saveRuleset();
    setFeedback("Ruleset salvato.");
    await loadAll();
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

await loadAll();
loadMapDraft(null);
loadPieceDraft(null);
loadVictoryDraft(null);
loadRulesetDraft(null);
