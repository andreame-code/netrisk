function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyDraft() {
  return {
    territories: [],
    continents: [],
    positions: {}
  };
}

function normalizePositions(positions = {}, territoryIds = new Set()) {
  return Object.entries(positions || {}).reduce((result, [territoryId, point]) => {
    if (!territoryIds.has(territoryId)) {
      return result;
    }

    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return result;
    }

    result[territoryId] = {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(6, Math.min(94, y))
    };
    return result;
  }, {});
}

function parsePersistedDraft(input = {}) {
  const territories = Array.isArray(input.territories)
    ? input.territories.map((territory) => ({
        id: String(territory.id || "").trim(),
        name: String(territory.name || "").trim(),
        continentId: territory.continentId == null ? null : String(territory.continentId),
        neighbors: Array.isArray(territory.neighbors)
          ? territory.neighbors.map((neighborId) => String(neighborId))
          : []
      }))
    : [];
  const continents = Array.isArray(input.continents)
    ? input.continents.map((continent) => ({
        id: String(continent.id || "").trim(),
        name: String(continent.name || "").trim(),
        bonus: Number.isFinite(Number(continent.bonus)) ? Number(continent.bonus) : 0
      }))
    : [];

  const membership = new Map();
  (input.continents || []).forEach((continent) => {
    (continent.territoryIds || []).forEach((territoryId) => {
      membership.set(String(territoryId), String(continent.id));
    });
  });

  territories.forEach((territory) => {
    if (!territory.continentId && membership.has(territory.id)) {
      territory.continentId = membership.get(territory.id);
    }
  });

  const territoryIds = new Set(territories.map((territory) => territory.id));
  territories.forEach((territory) => {
    territory.neighbors = territory.neighbors
      .filter((neighborId) => territoryIds.has(neighborId) && neighborId !== territory.id)
      .filter((neighborId, index, array) => array.indexOf(neighborId) === index);
  });

  const positions = normalizePositions(input.positions, territoryIds);
  return {
    territories,
    continents,
    positions
  };
}

function serializeDraft(draft) {
  const normalizedDraft = parsePersistedDraft(draft);
  return {
    territories: normalizedDraft.territories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      continentId: territory.continentId || null,
      neighbors: territory.neighbors.slice()
    })),
    continents: normalizedDraft.continents.map((continent) => ({
      id: continent.id,
      name: continent.name,
      bonus: Number.isFinite(Number(continent.bonus)) ? Number(continent.bonus) : 0,
      territoryIds: normalizedDraft.territories
        .filter((territory) => territory.continentId === continent.id)
        .map((territory) => territory.id)
    })),
    positions: clone(normalizedDraft.positions)
  };
}

function territoryLabel(territory) {
  return territory?.name || territory?.id || "Territorio";
}

export function createMapBuilder(options = {}) {
  const elements = options.elements || {};
  const state = {
    draft: createEmptyDraft(),
    selectedTerritoryId: null,
    selectedContinentId: null,
    addTerritoryMode: false,
    draggingTerritoryId: null
  };

  function notifyError(error) {
    if (typeof options.onError === "function") {
      options.onError(error);
    }
  }

  function setBoardModeLabel() {
    if (!elements.mapAddTerritory) {
      return;
    }

    elements.mapAddTerritory.textContent = state.addTerritoryMode ? "Click sulla board" : "Aggiungi territorio";
    elements.mapBoard?.classList.toggle("is-placement-mode", state.addTerritoryMode);
  }

  function territoryById(territoryId) {
    return state.draft.territories.find((territory) => territory.id === territoryId) || null;
  }

  function continentById(continentId) {
    return state.draft.continents.find((continent) => continent.id === continentId) || null;
  }

  function ensureSelections() {
    if (!territoryById(state.selectedTerritoryId)) {
      state.selectedTerritoryId = state.draft.territories[0]?.id || null;
    }

    if (!continentById(state.selectedContinentId)) {
      state.selectedContinentId = state.draft.continents[0]?.id || null;
    }
  }

  function nextTerritoryId() {
    let index = state.draft.territories.length + 1;
    while (territoryById(`territory-${index}`)) {
      index += 1;
    }
    return `territory-${index}`;
  }

  function nextContinentId() {
    let index = state.draft.continents.length + 1;
    while (continentById(`continent-${index}`)) {
      index += 1;
    }
    return `continent-${index}`;
  }

  function syncTextareas() {
    const serialized = serializeDraft(state.draft);
    if (elements.mapTerritories) {
      elements.mapTerritories.value = JSON.stringify(serialized.territories, null, 2);
    }
    if (elements.mapContinents) {
      elements.mapContinents.value = JSON.stringify(serialized.continents, null, 2);
    }
    if (elements.mapPositions) {
      elements.mapPositions.value = JSON.stringify(serialized.positions, null, 2);
    }
  }

  function applyBoardSurface() {
    if (!elements.mapBoard) {
      return;
    }

    const background = String(elements.mapBackground?.value || "").trim();
    elements.mapBoard.style.setProperty("--engine-map-image", background ? `url('${background.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')` : "none");

    const width = Number(elements.mapAspectWidth?.value);
    const height = Number(elements.mapAspectHeight?.value);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      elements.mapBoard.style.aspectRatio = `${width} / ${height}`;
    } else {
      elements.mapBoard.style.removeProperty("aspect-ratio");
    }
  }

  function renderTerritoryList() {
    if (!elements.mapTerritoryList) {
      return;
    }

    if (!state.draft.territories.length) {
      elements.mapTerritoryList.innerHTML = '<p class="setup-slot-note">Nessun territorio ancora presente.</p>';
      return;
    }

    elements.mapTerritoryList.innerHTML = state.draft.territories.map((territory) => (
      `<button type="button" class="engine-map-chip${territory.id === state.selectedTerritoryId ? " is-selected" : ""}" data-territory-id="${territory.id}">${territoryLabel(territory)}</button>`
    )).join("");
  }

  function renderContinentList() {
    if (!elements.mapContinentList) {
      return;
    }

    if (!state.draft.continents.length) {
      elements.mapContinentList.innerHTML = '<p class="setup-slot-note">Nessun continente definito.</p>';
      return;
    }

    elements.mapContinentList.innerHTML = state.draft.continents.map((continent) => {
      const territoryCount = state.draft.territories.filter((territory) => territory.continentId === continent.id).length;
      return `<button type="button" class="engine-map-chip${continent.id === state.selectedContinentId ? " is-selected" : ""}" data-continent-id="${continent.id}">${continent.name || continent.id} · ${territoryCount}</button>`;
    }).join("");
  }

  function renderTerritoryEditor() {
    const territory = territoryById(state.selectedTerritoryId);
    const otherTerritories = state.draft.territories.filter((item) => item.id !== territory?.id);

    if (elements.territoryId) {
      elements.territoryId.value = territory?.id || "";
      elements.territoryId.disabled = !territory;
    }
    if (elements.territoryName) {
      elements.territoryName.value = territory?.name || "";
      elements.territoryName.disabled = !territory;
    }
    if (elements.territoryContinent) {
      elements.territoryContinent.innerHTML = '<option value="">Senza continente</option>' + state.draft.continents.map((continent) => (
        `<option value="${continent.id}">${continent.name || continent.id}</option>`
      )).join("");
      elements.territoryContinent.value = territory?.continentId || "";
      elements.territoryContinent.disabled = !territory;
    }
    if (elements.territoryNeighbors) {
      elements.territoryNeighbors.innerHTML = territory
        ? otherTerritories.map((candidate) => (
            `<label class="engine-map-checkbox"><input type="checkbox" data-neighbor-id="${candidate.id}" ${territory.neighbors.includes(candidate.id) ? "checked" : ""} /> <span>${territoryLabel(candidate)}</span></label>`
          )).join("")
        : '<p class="setup-slot-note">Seleziona o crea un territorio per gestire i link.</p>';
    }
    if (elements.mapRemoveTerritory) {
      elements.mapRemoveTerritory.disabled = !territory;
    }
  }

  function renderContinentEditor() {
    const continent = continentById(state.selectedContinentId);
    if (elements.continentId) {
      elements.continentId.value = continent?.id || "";
      elements.continentId.disabled = !continent;
    }
    if (elements.continentName) {
      elements.continentName.value = continent?.name || "";
      elements.continentName.disabled = !continent;
    }
    if (elements.continentBonus) {
      elements.continentBonus.value = continent ? String(continent.bonus || 0) : "";
      elements.continentBonus.disabled = !continent;
    }
    if (elements.mapRemoveContinent) {
      elements.mapRemoveContinent.disabled = !continent;
    }
  }

  function renderBoard() {
    if (!elements.mapLinks || !elements.mapNodes) {
      return;
    }

    const positions = serializeDraft(state.draft).positions;
    const drawn = new Set();
    const links = [];
    state.draft.territories.forEach((territory) => {
      const source = positions[territory.id];
      if (!source) {
        return;
      }

      territory.neighbors.forEach((neighborId) => {
        const target = positions[neighborId];
        const key = [territory.id, neighborId].sort().join(":");
        if (!target || drawn.has(key)) {
          return;
        }

        drawn.add(key);
        links.push(`<line class="engine-map-link" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"></line>`);
      });
    });
    elements.mapLinks.innerHTML = links.join("");

    elements.mapNodes.innerHTML = state.draft.territories.map((territory) => {
      const point = positions[territory.id] || { x: 50, y: 50 };
      const continent = continentById(territory.continentId);
      return `<button type="button" class="engine-map-node${territory.id === state.selectedTerritoryId ? " is-selected" : ""}" data-territory-id="${territory.id}" style="left:${point.x}%; top:${point.y}%;" title="${territoryLabel(territory)}">${continent?.name ? continent.name.charAt(0).toUpperCase() : territoryLabel(territory).charAt(0).toUpperCase()}</button>`;
    }).join("");
  }

  function render() {
    ensureSelections();
    syncTextareas();
    applyBoardSurface();
    renderBoard();
    renderTerritoryList();
    renderContinentList();
    renderTerritoryEditor();
    renderContinentEditor();
    setBoardModeLabel();
  }

  function updateTerritoryNeighbors(territoryId, neighborId, enabled) {
    const territory = territoryById(territoryId);
    const neighbor = territoryById(neighborId);
    if (!territory || !neighbor || territory.id === neighbor.id) {
      return;
    }

    if (enabled) {
      if (!territory.neighbors.includes(neighborId)) {
        territory.neighbors.push(neighborId);
      }
      if (!neighbor.neighbors.includes(territoryId)) {
        neighbor.neighbors.push(territoryId);
      }
    } else {
      territory.neighbors = territory.neighbors.filter((id) => id !== neighborId);
      neighbor.neighbors = neighbor.neighbors.filter((id) => id !== territoryId);
    }
  }

  function moveTerritoryToPoint(territoryId, point) {
    state.draft.positions[territoryId] = {
      x: Math.max(4, Math.min(96, point.x)),
      y: Math.max(6, Math.min(94, point.y))
    };
    render();
  }

  function boardPointFromEvent(event) {
    const rect = elements.mapBoard.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  function addTerritory(point = { x: 50, y: 50 }) {
    const territoryId = nextTerritoryId();
    state.draft.territories.push({
      id: territoryId,
      name: `Territory ${state.draft.territories.length}`,
      continentId: state.selectedContinentId || null,
      neighbors: []
    });
    moveTerritoryToPoint(territoryId, point);
    state.selectedTerritoryId = territoryId;
    state.addTerritoryMode = false;
    render();
  }

  function removeSelectedTerritory() {
    const territory = territoryById(state.selectedTerritoryId);
    if (!territory) {
      return;
    }

    state.draft.territories = state.draft.territories.filter((item) => item.id !== territory.id);
    delete state.draft.positions[territory.id];
    state.draft.territories.forEach((item) => {
      item.neighbors = item.neighbors.filter((neighborId) => neighborId !== territory.id);
    });
    render();
  }

  function addContinent() {
    const continentId = nextContinentId();
    state.draft.continents.push({
      id: continentId,
      name: `Continent ${state.draft.continents.length + 1}`,
      bonus: 1
    });
    state.selectedContinentId = continentId;
    render();
  }

  function removeSelectedContinent() {
    const continent = continentById(state.selectedContinentId);
    if (!continent) {
      return;
    }

    state.draft.continents = state.draft.continents.filter((item) => item.id !== continent.id);
    state.draft.territories.forEach((territory) => {
      if (territory.continentId === continent.id) {
        territory.continentId = null;
      }
    });
    render();
  }

  function renameEntity(list, previousId, nextId, applyReference) {
    const normalizedNextId = String(nextId || "").trim();
    if (!normalizedNextId || normalizedNextId === previousId) {
      return previousId;
    }

    if (list.some((item) => item.id === normalizedNextId)) {
      throw new Error("Questo id e gia in uso.");
    }

    applyReference(normalizedNextId);
    return normalizedNextId;
  }

  function syncDraftFromTextareas() {
    const territories = JSON.parse(elements.mapTerritories.value || "[]");
    const continents = JSON.parse(elements.mapContinents.value || "[]");
    const positions = JSON.parse(elements.mapPositions.value || "{}");
    state.draft = parsePersistedDraft({ territories, continents, positions });
    render();
  }

  function readPayload() {
    if (elements.mapTerritories?.value.trim() || elements.mapContinents?.value.trim() || elements.mapPositions?.value.trim()) {
      try {
        syncDraftFromTextareas();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    }

    const serialized = serializeDraft(state.draft);
    return {
      name: String(elements.mapName?.value || "").trim(),
      backgroundImage: String(elements.mapBackground?.value || "").trim() || null,
      aspectRatio: elements.mapAspectWidth?.value && elements.mapAspectHeight?.value
        ? {
            width: Number(elements.mapAspectWidth.value),
            height: Number(elements.mapAspectHeight.value)
          }
        : null,
      territories: serialized.territories,
      continents: serialized.continents,
      positions: serialized.positions
    };
  }

  function loadDraft(item) {
    state.draft = parsePersistedDraft(item || createEmptyDraft());
    state.selectedTerritoryId = state.draft.territories[0]?.id || null;
    state.selectedContinentId = state.draft.continents[0]?.id || null;
    state.addTerritoryMode = false;
    render();
  }

  elements.mapAddTerritory?.addEventListener("click", () => {
    state.addTerritoryMode = !state.addTerritoryMode;
    render();
  });

  elements.mapBoard?.addEventListener("click", (event) => {
    if (event.target.closest("[data-territory-id]")) {
      return;
    }

    if (!state.addTerritoryMode) {
      return;
    }

    addTerritory(boardPointFromEvent(event));
  });

  elements.mapNodes?.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-territory-id]");
    if (!button) {
      return;
    }

    state.selectedTerritoryId = button.dataset.territoryId;
    state.draggingTerritoryId = button.dataset.territoryId;
    button.setPointerCapture?.(event.pointerId);
    render();
  });

  elements.mapNodes?.addEventListener("pointermove", (event) => {
    if (!state.draggingTerritoryId) {
      return;
    }
    moveTerritoryToPoint(state.draggingTerritoryId, boardPointFromEvent(event));
  });

  function stopDragging() {
    state.draggingTerritoryId = null;
  }

  elements.mapNodes?.addEventListener("pointerup", stopDragging);
  elements.mapNodes?.addEventListener("pointercancel", stopDragging);

  elements.mapTerritoryList?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-territory-id]");
    if (!trigger) {
      return;
    }

    state.selectedTerritoryId = trigger.dataset.territoryId;
    render();
  });

  elements.mapContinentList?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-continent-id]");
    if (!trigger) {
      return;
    }

    state.selectedContinentId = trigger.dataset.continentId;
    render();
  });

  elements.mapRemoveTerritory?.addEventListener("click", removeSelectedTerritory);
  elements.mapAddContinent?.addEventListener("click", addContinent);
  elements.mapRemoveContinent?.addEventListener("click", removeSelectedContinent);

  elements.territoryId?.addEventListener("change", () => {
    const territory = territoryById(state.selectedTerritoryId);
    if (!territory) {
      return;
    }

    try {
      const previousId = territory.id;
      territory.id = renameEntity(state.draft.territories, previousId, elements.territoryId.value, (nextId) => {
        state.draft.territories.forEach((item) => {
          item.neighbors = item.neighbors.map((neighborId) => neighborId === previousId ? nextId : neighborId);
          if (item.id === previousId) {
            item.id = nextId;
          }
        });
        if (state.draft.positions[previousId]) {
          state.draft.positions[nextId] = state.draft.positions[previousId];
          delete state.draft.positions[previousId];
        }
        state.selectedTerritoryId = nextId;
      });
      render();
    } catch (error) {
      notifyError(error);
      render();
    }
  });

  elements.territoryName?.addEventListener("input", () => {
    const territory = territoryById(state.selectedTerritoryId);
    if (!territory) {
      return;
    }
    territory.name = elements.territoryName.value;
    render();
  });

  elements.territoryContinent?.addEventListener("change", () => {
    const territory = territoryById(state.selectedTerritoryId);
    if (!territory) {
      return;
    }
    territory.continentId = elements.territoryContinent.value || null;
    render();
  });

  elements.territoryNeighbors?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-neighbor-id]");
    if (!input || !state.selectedTerritoryId) {
      return;
    }

    updateTerritoryNeighbors(state.selectedTerritoryId, input.dataset.neighborId, input.checked);
    render();
  });

  elements.continentId?.addEventListener("change", () => {
    const continent = continentById(state.selectedContinentId);
    if (!continent) {
      return;
    }

    try {
      const previousId = continent.id;
      continent.id = renameEntity(state.draft.continents, previousId, elements.continentId.value, (nextId) => {
        state.draft.continents.forEach((item) => {
          if (item.id === previousId) {
            item.id = nextId;
          }
        });
        state.draft.territories.forEach((territory) => {
          if (territory.continentId === previousId) {
            territory.continentId = nextId;
          }
        });
        state.selectedContinentId = nextId;
      });
      render();
    } catch (error) {
      notifyError(error);
      render();
    }
  });

  elements.continentName?.addEventListener("input", () => {
    const continent = continentById(state.selectedContinentId);
    if (!continent) {
      return;
    }
    continent.name = elements.continentName.value;
    render();
  });

  elements.continentBonus?.addEventListener("input", () => {
    const continent = continentById(state.selectedContinentId);
    if (!continent) {
      return;
    }
    continent.bonus = Number(elements.continentBonus.value || 0);
    render();
  });

  ["input", "change"].forEach((eventName) => {
    elements.mapBackground?.addEventListener(eventName, applyBoardSurface);
    elements.mapAspectWidth?.addEventListener(eventName, applyBoardSurface);
    elements.mapAspectHeight?.addEventListener(eventName, applyBoardSurface);
  });

  ["change", "blur"].forEach((eventName) => {
    elements.mapTerritories?.addEventListener(eventName, () => {
      try {
        syncDraftFromTextareas();
      } catch (error) {
        notifyError(error);
      }
    });
    elements.mapContinents?.addEventListener(eventName, () => {
      try {
        syncDraftFromTextareas();
      } catch (error) {
        notifyError(error);
      }
    });
    elements.mapPositions?.addEventListener(eventName, () => {
      try {
        syncDraftFromTextareas();
      } catch (error) {
        notifyError(error);
      }
    });
  });

  loadDraft(null);

  return {
    loadDraft,
    readPayload
  };
}
