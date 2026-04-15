import { byId, closest, maybeQuery, setDisabled, setHidden, setMarkup } from "./core/dom.mjs";
import { messageFromError } from "./core/errors.mjs";
import { mountModuleSlotSection } from "./core/module-slots.mjs";
import type {
  ContentPackSummary,
  DiceRuleSet,
  GameOptionsResponse,
  InstalledModuleSummary,
  LoginResponse,
  MapSummary,
  NetRiskContentContribution,
  NetRiskGamePreset,
  NetRiskModuleProfile,
  PieceSkin,
  PublicUser,
  RuleSetSummary,
  VictoryRuleSet,
  VisualTheme
} from "./core/types.mjs";
import { t, translateServerMessage } from "./i18n.mjs";

const state: {
  contentPacks: ContentPackSummary[];
  ruleSets: RuleSetSummary[];
  maps: MapSummary[];
  diceRuleSets: DiceRuleSet[];
  victoryRuleSets: VictoryRuleSet[];
  themes: VisualTheme[];
  pieceSkins: PieceSkin[];
  modules: InstalledModuleSummary[];
  gamePresets: NetRiskGamePreset[];
  contentProfiles: NetRiskModuleProfile[];
  gameplayProfiles: NetRiskModuleProfile[];
  uiProfiles: NetRiskModuleProfile[];
  turnTimeoutHoursOptions: number[];
  selectedGamePresetId: string | null;
  user: PublicUser | null;
  creating: boolean;
  sessionReady: boolean;
} = {
  contentPacks: [],
  ruleSets: [],
  maps: [],
  diceRuleSets: [],
  victoryRuleSets: [],
  themes: [],
  pieceSkins: [],
  modules: [],
  gamePresets: [],
  contentProfiles: [],
  gameplayProfiles: [],
  uiProfiles: [],
  turnTimeoutHoursOptions: [],
  selectedGamePresetId: null,
  user: null,
  creating: false,
  sessionReady: false
};

const elements = {
  authStatus: byId("setup-auth-status"),
  feedback: byId("new-game-feedback"),
  form: byId("new-game-form") as HTMLFormElement,
  gameName: byId("setup-game-name") as HTMLInputElement,
  headerLoginForm: maybeQuery("#header-login-form"),
  headerAuthUsername: maybeQuery<HTMLInputElement>("#header-auth-username"),
  headerAuthPassword: maybeQuery<HTMLInputElement>("#header-auth-password"),
  headerLoginButton: maybeQuery<HTMLButtonElement>("#header-login-button"),
  logoutButton: byId("logout-button") as HTMLButtonElement,
  contentPack: byId("setup-content-pack") as HTMLSelectElement,
  contentPackSummary: byId("setup-content-pack-summary"),
  ruleSet: byId("setup-ruleset") as HTMLSelectElement,
  ruleSetSummary: byId("setup-ruleset-summary"),
  map: byId("setup-map") as HTMLSelectElement,
  mapDetails: byId("setup-map-details"),
  customizeOptions: byId("setup-customize-options") as HTMLInputElement,
  advancedOptions: byId("setup-advanced-options"),
  diceRuleSet: byId("setup-dice-ruleset") as HTMLSelectElement,
  victoryRuleSet: byId("setup-victory-ruleset") as HTMLSelectElement,
  theme: byId("setup-theme") as HTMLSelectElement,
  pieceSkin: byId("setup-piece-skin") as HTMLSelectElement,
  turnTimeoutHours: byId("setup-turn-timeout-hours") as HTMLSelectElement,
  playerSlots: byId("setup-player-slots"),
  submit: byId("submit-new-game") as HTMLButtonElement,
  totalPlayers: byId("setup-total-players") as HTMLSelectElement
};

const CONTENT_CONTRIBUTION_KEYS = [
  "mapIds",
  "siteThemeIds",
  "pieceSkinIds",
  "playerPieceSetIds",
  "contentPackIds",
  "diceRuleSetIds",
  "cardRuleSetIds",
  "victoryRuleSetIds",
  "fortifyRuleSetIds",
  "reinforcementRuleSetIds"
] as const;

type ContentContributionKey = (typeof CONTENT_CONTRIBUTION_KEYS)[number];

function setHeaderAuthFeedback(message = ""): void {
  if (!message) {
    window.netriskShell?.clearHeaderAuthFeedback?.();
    return;
  }

  window.netriskShell?.setHeaderAuthFeedback?.(message, "error");
}

function renderNavAvatar(username = "") {
  const avatar = maybeQuery("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function slotDescription(type: string, index: number): string {
  if (index === 0) {
    return t("newGame.slot.locked");
  }

  return type === "ai"
    ? t("newGame.slot.aiDescription")
    : t("newGame.slot.humanDescription");
}

function slotMarkup(index: number): string {
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
    const typeControl = slot.querySelector('[data-role="type"]') as HTMLSelectElement | null;
    const type = typeControl ? typeControl.value : "human";
    const note = slot.querySelector('[data-role="note"]');
    if (note) {
      note.textContent = slotDescription(type, index);
    }
  });
}

function renderSlots() {
  const total = Number(elements.totalPlayers.value || 2);
  setMarkup(elements.playerSlots, Array.from({ length: total }, (_, index) => slotMarkup(index)).join(""));
  updateSlotNotes();
}

function setFeedback(message: string, type = ""): void {
  elements.feedback.className = "session-feedback" + (type === "error" ? " is-error" : "") + (message ? "" : " is-hidden");
  elements.feedback.textContent = message || "";
}

function updateSubmitState() {
  setDisabled(elements.submit, state.creating || !state.sessionReady || !state.user);
}

function emptyContentContribution(): NetRiskContentContribution {
  return {
    mapIds: [],
    siteThemeIds: [],
    pieceSkinIds: [],
    playerPieceSetIds: [],
    contentPackIds: [],
    diceRuleSetIds: [],
    cardRuleSetIds: [],
    victoryRuleSetIds: [],
    fortifyRuleSetIds: [],
    reinforcementRuleSetIds: []
  };
}

function filterByAllowedIds<T extends { id: string }>(entries: T[], allowedIds: string[] | undefined): T[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries;
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id));
}

function selectedModuleIdSet(): Set<string> {
  return new Set(["core.base", ...selectedModuleIds()]);
}

function selectedModuleEntries(): InstalledModuleSummary[] {
  const selectedIds = selectedModuleIdSet();
  return state.modules.filter((moduleEntry) => selectedIds.has(moduleEntry.id));
}

function aggregateSelectedModuleContent(): NetRiskContentContribution {
  const contribution = emptyContentContribution();

  selectedModuleEntries().forEach((moduleEntry) => {
    const content = moduleEntry.clientManifest?.content;
    if (!content) {
      return;
    }

    CONTENT_CONTRIBUTION_KEYS.forEach((key) => {
      const currentValues = contribution[key] || [];
      const nextValues = Array.isArray(content[key]) ? content[key] : [];
      contribution[key] = Array.from(new Set([...currentValues, ...nextValues]));
    });
  });

  return contribution;
}

function filterProfilesForSelectedModules(profiles: NetRiskModuleProfile[]): NetRiskModuleProfile[] {
  const selectedIds = selectedModuleIdSet();
  return profiles.filter((profile) => !profile.moduleId || selectedIds.has(profile.moduleId));
}

function availableGamePresets(): NetRiskGamePreset[] {
  return state.gamePresets.filter((preset) =>
    !preset.moduleId || state.modules.some((moduleEntry) => moduleEntry.id === preset.moduleId)
  );
}

function selectMarkup(options: Array<{ value: string; label: string }>): string {
  return options.map((option) => '<option value="' + option.value + '">' + option.label + '</option>').join("");
}

function setSelectOptions(
  select: HTMLSelectElement,
  options: Array<{ value: string; label: string }>,
  preferredValue?: string | null
): void {
  const previousValue = preferredValue ?? select.value;
  setMarkup(select, selectMarkup(options));

  if (options.some((option) => option.value === previousValue)) {
    select.value = previousValue;
    return;
  }

  select.value = options[0]?.value || "";
}

function setSelectValueIfAvailable(select: HTMLSelectElement, value: string | null | undefined): void {
  if (!value) {
    return;
  }

  const hasValue = Array.from(select.options).some((option) => option.value === value);
  if (hasValue) {
    select.value = value;
  }
}

function selectedMapSummary(): MapSummary | null {
  return state.maps.find((map) => map.id === elements.map.value) || null;
}

function selectedContentPack(): ContentPackSummary | null {
  return state.contentPacks.find((pack) => pack.id === elements.contentPack.value) || null;
}

function selectedRuleSet(): RuleSetSummary | null {
  return state.ruleSets.find((ruleSet) => ruleSet.id === elements.ruleSet.value) || null;
}

function selectedDiceRuleSet(): DiceRuleSet | null {
  return state.diceRuleSets.find((ruleSet) => ruleSet.id === elements.diceRuleSet.value) || null;
}

function selectedVictoryRuleSet(): VictoryRuleSet | null {
  return state.victoryRuleSets.find((ruleSet) => ruleSet.id === elements.victoryRuleSet.value) || null;
}

function selectedTheme(): VisualTheme | null {
  return state.themes.find((theme) => theme.id === elements.theme.value) || null;
}

function selectedPieceSkin(): PieceSkin | null {
  return state.pieceSkins.find((pieceSkin) => pieceSkin.id === elements.pieceSkin.value) || null;
}

function diceRuleSetLabel(ruleSet: DiceRuleSet | null): string {
  if (!ruleSet) {
    return t("common.notAvailable");
  }

  return ruleSet.name + " (" + ruleSet.attackerMaxDice + "/" + ruleSet.defenderMaxDice + ")";
}

function syncContentPackDefaults() {
  const contentPack = selectedContentPack();
  if (!contentPack) {
    return;
  }

  setSelectValueIfAvailable(elements.map, contentPack.defaultMapId);
  setSelectValueIfAvailable(elements.diceRuleSet, contentPack.defaultDiceRuleSetId);
}

function renderContentPackSummary() {
  const contentPack = selectedContentPack();
  if (!contentPack) {
    setMarkup(elements.contentPackSummary, "");
    return;
  }

  const map = state.maps.find((entry) => entry.id === contentPack.defaultMapId) || null;
  const diceRuleSet = state.diceRuleSets.find((entry) => entry.id === contentPack.defaultDiceRuleSetId) || null;

  setMarkup(elements.contentPackSummary,
    '<div class="map-setup-card-head">' +
      '<strong>' + contentPack.name + '</strong>' +
      '<span class="badge">' + (map ? map.name : contentPack.defaultMapId) + '</span>' +
    '</div>' +
    '<p class="map-setup-copy">' +
      t("newGame.contentPack.summary", {
        description: contentPack.description,
        mapName: map ? map.name : contentPack.defaultMapId,
        dice: diceRuleSetLabel(diceRuleSet)
      }) +
    '</p>');
}

function namedOptionLabel(option: { name: string } | null): string {
  return option?.name || t("common.notAvailable");
}

function syncRuleSetDefaults() {
  const ruleSet = selectedRuleSet();
  if (!ruleSet) {
    return;
  }

  setSelectValueIfAvailable(elements.map, ruleSet.defaults.mapId);
  setSelectValueIfAvailable(elements.diceRuleSet, ruleSet.defaults.diceRuleSetId);
  setSelectValueIfAvailable(elements.victoryRuleSet, ruleSet.defaults.victoryRuleSetId);
  setSelectValueIfAvailable(elements.theme, ruleSet.defaults.themeId);
  setSelectValueIfAvailable(elements.pieceSkin, ruleSet.defaults.pieceSkinId);
}

function renderRuleSetSummary() {
  const ruleSet = selectedRuleSet();
  if (!ruleSet) {
    setMarkup(elements.ruleSetSummary, "");
    return;
  }

  const activeDiceRuleSet = elements.customizeOptions.checked
    ? selectedDiceRuleSet()
    : state.diceRuleSets.find((entry) => entry.id === ruleSet.defaults.diceRuleSetId) || null;
  const activeVictoryRuleSet = elements.customizeOptions.checked
    ? selectedVictoryRuleSet()
    : state.victoryRuleSets.find((entry) => entry.id === ruleSet.defaults.victoryRuleSetId) || null;
  const activeTheme = elements.customizeOptions.checked
    ? selectedTheme()
    : state.themes.find((entry) => entry.id === ruleSet.defaults.themeId) || null;
  const activePieceSkin = elements.customizeOptions.checked
    ? selectedPieceSkin()
    : state.pieceSkins.find((entry) => entry.id === ruleSet.defaults.pieceSkinId) || null;

  setMarkup(elements.ruleSetSummary,
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
    '</p>' +
    '<div class="session-detail-tags">' +
      '<span class="badge">' + namedOptionLabel(activeVictoryRuleSet) + '</span>' +
      '<span class="badge">' + namedOptionLabel(activeTheme) + '</span>' +
      '<span class="badge">' + namedOptionLabel(activePieceSkin) + '</span>' +
      '<span class="badge">' + (selectedMapSummary()?.name || t("common.notAvailable")) + '</span>' +
      (selectedModuleIds().length
        ? '<span class="badge">' + selectedModuleIds().length + ' mod</span>'
        : '') +
    '</div>' +
    '<p class="map-setup-copy">' +
      namedOptionLabel(activeVictoryRuleSet) + " · " + namedOptionLabel(activeTheme) + " · " + namedOptionLabel(activePieceSkin) +
    '</p>');
}

function renderAdvancedOptions() {
  setHidden(elements.advancedOptions, !elements.customizeOptions.checked);
  renderModuleOptions();
  renderRuleSetSummary();
}

function ensureModuleOptionsContainer(): HTMLElement {
  let container = document.querySelector("#setup-module-options") as HTMLElement | null;
  if (container) {
    return container;
  }

  container = document.createElement("section");
  container.id = "setup-module-options";
  container.className = "setup-options-stack";
  elements.advancedOptions.appendChild(container);
  return container;
}

function selectedModuleIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("[data-module-checkbox]:checked"))
    .map((checkbox) => checkbox.value)
    .filter(Boolean);
}

function selectedProfileValue(profileKind: "content" | "gameplay" | "ui"): string | undefined {
  const select = document.querySelector(`#setup-${profileKind}-profile`) as HTMLSelectElement | null;
  return select?.value || undefined;
}

function gamePresetSelectMarkup(presets: NetRiskGamePreset[]): string {
  return '<label class="field-stack"><span>Preset modulo</span><select id="setup-game-preset">' +
    '<option value="">' + t("common.notAvailable") + '</option>' +
    presets.map((preset) => '<option value="' + preset.id + '">' + preset.name + '</option>').join("") +
  '</select></label>';
}

function dropSelectedGamePreset(): void {
  if (!state.selectedGamePresetId) {
    return;
  }

  state.selectedGamePresetId = null;
  renderModuleOptions();
}

function applySelectedGamePreset(presetId: string): void {
  const preset = availableGamePresets().find((entry) => entry.id === presetId) || null;
  state.selectedGamePresetId = preset ? preset.id : null;

  Array.from(document.querySelectorAll<HTMLInputElement>("[data-module-checkbox]")).forEach((checkbox) => {
    checkbox.checked = Boolean(preset && Array.isArray(preset.activeModuleIds) && preset.activeModuleIds.includes(checkbox.value));
  });

  renderModuleOptions();
  refreshSelectableCatalogs();

  const contentProfileSelect = document.querySelector("#setup-content-profile") as HTMLSelectElement | null;
  const gameplayProfileSelect = document.querySelector("#setup-gameplay-profile") as HTMLSelectElement | null;
  const uiProfileSelect = document.querySelector("#setup-ui-profile") as HTMLSelectElement | null;

  if (contentProfileSelect) {
    contentProfileSelect.value = preset?.contentProfileId || "";
  }
  if (gameplayProfileSelect) {
    gameplayProfileSelect.value = preset?.gameplayProfileId || "";
  }
  if (uiProfileSelect) {
    uiProfileSelect.value = preset?.uiProfileId || "";
  }

  setSelectValueIfAvailable(elements.contentPack, preset?.defaults?.contentPackId);
  setSelectValueIfAvailable(elements.ruleSet, preset?.defaults?.ruleSetId);
  setSelectValueIfAvailable(elements.map, preset?.defaults?.mapId);
  setSelectValueIfAvailable(elements.diceRuleSet, preset?.defaults?.diceRuleSetId);
  setSelectValueIfAvailable(elements.victoryRuleSet, preset?.defaults?.victoryRuleSetId);
  setSelectValueIfAvailable(elements.theme, preset?.defaults?.themeId);
  setSelectValueIfAvailable(elements.pieceSkin, preset?.defaults?.pieceSkinId);

  renderContentPackSummary();
  renderMapDetails();
  renderRuleSetSummary();
}

function availableContentProfiles(): NetRiskModuleProfile[] {
  return filterProfilesForSelectedModules(state.contentProfiles);
}

function availableGameplayProfiles(): NetRiskModuleProfile[] {
  return filterProfilesForSelectedModules(state.gameplayProfiles);
}

function availableUiProfiles(): NetRiskModuleProfile[] {
  return filterProfilesForSelectedModules(state.uiProfiles);
}

function profileSelectMarkup(profileKind: "content" | "gameplay" | "ui", label: string, profiles: NetRiskModuleProfile[]): string {
  return '<label class="field-stack"><span>' + label + '</span><select id="setup-' + profileKind + '-profile">' +
    '<option value="">' + t("common.notAvailable") + '</option>' +
    profiles.map((profile) => '<option value="' + profile.id + '">' + profile.name + '</option>').join("") +
  '</select></label>';
}

function refreshSelectableCatalogs(): void {
  const selectedContent = aggregateSelectedModuleContent();
  const availableContentPackOptions = filterByAllowedIds(state.contentPacks, selectedContent.contentPackIds)
    .map((pack) => ({ value: pack.id, label: pack.name }));
  const availableMapOptions = filterByAllowedIds(state.maps, selectedContent.mapIds)
    .map((map) => ({ value: map.id, label: map.name }));
  const availableDiceOptions = filterByAllowedIds(state.diceRuleSets, selectedContent.diceRuleSetIds)
    .map((ruleSet) => ({ value: ruleSet.id, label: diceRuleSetLabel(ruleSet) }));
  const availableVictoryOptions = filterByAllowedIds(state.victoryRuleSets, selectedContent.victoryRuleSetIds)
    .map((ruleSet) => ({ value: ruleSet.id, label: ruleSet.name }));
  const availableThemeOptions = filterByAllowedIds(state.themes, selectedContent.siteThemeIds)
    .map((theme) => ({ value: theme.id, label: theme.name }));
  const availablePieceSkinOptions = filterByAllowedIds(state.pieceSkins, selectedContent.pieceSkinIds)
    .map((pieceSkin) => ({ value: pieceSkin.id, label: pieceSkin.name }));

  setSelectOptions(elements.contentPack, availableContentPackOptions);
  setSelectOptions(elements.map, availableMapOptions);
  setSelectOptions(elements.diceRuleSet, availableDiceOptions);
  setSelectOptions(elements.victoryRuleSet, availableVictoryOptions);
  setSelectOptions(elements.theme, availableThemeOptions);
  setSelectOptions(elements.pieceSkin, availablePieceSkinOptions);

  if (!elements.customizeOptions.checked) {
    syncContentPackDefaults();
    syncRuleSetDefaults();
  }
}

function renderModuleOptions() {
  const container = ensureModuleOptionsContainer();
  const visibleModules = state.modules.filter((moduleEntry) => moduleEntry.id !== "core.base");
  const gamePresets = availableGamePresets();
  if (!visibleModules.length && !gamePresets.length && !state.contentProfiles.length && !state.gameplayProfiles.length && !state.uiProfiles.length) {
    setMarkup(container, "");
    setHidden(container, true);
    return;
  }

  const selectedIds = new Set(selectedModuleIds());
  const selectedContentProfileId = selectedProfileValue("content") || "";
  const selectedGameplayProfileId = selectedProfileValue("gameplay") || "";
  const selectedUiProfileId = selectedProfileValue("ui") || "";
  const contentProfiles = availableContentProfiles();
  const gameplayProfiles = availableGameplayProfiles();
  const uiProfiles = availableUiProfiles();

  setHidden(container, false);
  setMarkup(container,
    '<div class="map-setup-card-head">' +
      '<strong>Moduli partita</strong>' +
      '<span class="badge">' + visibleModules.length + '</span>' +
    '</div>' +
    '<p class="map-setup-copy">Attiva i moduli compatibili installati sul server e salva i profili da associare alla partita.</p>' +
    gamePresetSelectMarkup(gamePresets) +
    '<div class="setup-player-slots">' +
      (visibleModules.length
        ? visibleModules.map((moduleEntry) =>
            '<label class="setup-slot">' +
              '<span class="setup-slot-head"><strong>' + moduleEntry.displayName + '</strong><span class="badge">' + (moduleEntry.kind || "module") + '</span></span>' +
              '<span class="map-setup-copy">' + (moduleEntry.description || "") + '</span>' +
              '<input type="checkbox" data-module-checkbox value="' + moduleEntry.id + '"' + (selectedIds.has(moduleEntry.id) ? " checked" : "") + ' />' +
            '</label>'
          ).join("")
        : '<p class="map-setup-copy">Nessun modulo extra disponibile.</p>') +
    '</div>' +
    '<div class="setup-advanced-options">' +
      profileSelectMarkup("content", "Profilo contenuti", contentProfiles) +
      profileSelectMarkup("gameplay", "Profilo gameplay", gameplayProfiles) +
      profileSelectMarkup("ui", "Profilo UI", uiProfiles) +
    '</div>'
  );

  const contentProfileSelect = document.querySelector("#setup-content-profile") as HTMLSelectElement | null;
  const gameplayProfileSelect = document.querySelector("#setup-gameplay-profile") as HTMLSelectElement | null;
  const uiProfileSelect = document.querySelector("#setup-ui-profile") as HTMLSelectElement | null;

  if (contentProfileSelect && contentProfiles.some((profile) => profile.id === selectedContentProfileId)) {
    contentProfileSelect.value = selectedContentProfileId;
  }
  if (gameplayProfileSelect && gameplayProfiles.some((profile) => profile.id === selectedGameplayProfileId)) {
    gameplayProfileSelect.value = selectedGameplayProfileId;
  }
  if (uiProfileSelect && uiProfiles.some((profile) => profile.id === selectedUiProfileId)) {
    uiProfileSelect.value = selectedUiProfileId;
  }

  const gamePresetSelect = document.querySelector("#setup-game-preset") as HTMLSelectElement | null;
  if (gamePresetSelect && state.selectedGamePresetId && gamePresets.some((preset) => preset.id === state.selectedGamePresetId)) {
    gamePresetSelect.value = state.selectedGamePresetId;
  }
}

function renderMapDetails() {
  const map = selectedMapSummary();
  if (!map) {
    setMarkup(elements.mapDetails, "");
    return;
  }

  const bonuses = Array.isArray(map.continentBonuses) ? map.continentBonuses : [];
  const bonusMarkup = bonuses.map((continent) =>
    '<li><span>' + continent.name + '</span><strong>' + t("newGame.map.bonusLine", { bonus: continent.bonus, territoryCount: continent.territoryCount }) + '</strong></li>'
  ).join("");

  setMarkup(elements.mapDetails,
    '<div class="map-setup-card-head">' +
      '<strong>' + map.name + '</strong>' +
      '<span class="badge">'
        + t("newGame.map.summary", { territoryCount: map.territoryCount, continentCount: map.continentCount }) +
      '</span>' +
    '</div>' +
    '<p class="map-setup-copy">' + t("newGame.map.copy") + '</p>' +
    '<ul class="map-setup-bonus-list">' + bonusMarkup + '</ul>');
}

function readConfig() {
  const totalPlayers = Number(elements.totalPlayers.value || 2);
  const players = Array.from(elements.playerSlots.querySelectorAll("[data-slot-index]"))
    .map((slot, index) => ({
      type: index === 0 ? "human" : ((slot.querySelector('[data-role="type"]') as HTMLSelectElement | null)?.value || "human"),
      slot: index + 1
    }));

  return {
    name: elements.gameName.value.trim() || undefined,
    contentPackId: elements.contentPack.value,
    ruleSetId: elements.ruleSet.value,
    mapId: elements.map.value,
    diceRuleSetId: elements.diceRuleSet.value,
    victoryRuleSetId: elements.victoryRuleSet.value,
    themeId: elements.theme.value,
    pieceSkinId: elements.pieceSkin.value,
    ...(state.selectedGamePresetId ? { gamePresetId: state.selectedGamePresetId } : {}),
    activeModuleIds: selectedModuleIds(),
    ...(selectedProfileValue("content") ? { contentProfileId: selectedProfileValue("content") } : {}),
    ...(selectedProfileValue("gameplay") ? { gameplayProfileId: selectedProfileValue("gameplay") } : {}),
    ...(selectedProfileValue("ui") ? { uiProfileId: selectedProfileValue("ui") } : {}),
    ...(elements.turnTimeoutHours.value ? { turnTimeoutHours: Number(elements.turnTimeoutHours.value) } : {}),
    totalPlayers,
    players
  };
}

async function send(path: string, body: unknown): Promise<LoginResponse & { game?: { id: string }; playerId?: string | null }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json() as LoginResponse & { game?: { id: string }; playerId?: string | null };
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.requestFailed")));
  }
  return data;
}

async function loadOptions() {
  const response = await fetch("/api/game/options");
  const data = await response.json() as GameOptionsResponse;
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("newGame.errors.loadOptions")));
  }

  state.contentPacks = data.contentPacks || [];
  state.maps = data.maps || [];
  state.ruleSets = data.ruleSets || [];
  state.diceRuleSets = data.diceRuleSets || [];
  state.victoryRuleSets = data.victoryRuleSets || [];
  state.themes = data.themes || [];
  state.pieceSkins = data.pieceSkins || [];
  state.modules = data.modules || [];
  state.gamePresets = data.gamePresets || [];
  state.contentProfiles = data.contentProfiles || [];
  state.gameplayProfiles = data.gameplayProfiles || [];
  state.uiProfiles = data.uiProfiles || [];
  state.turnTimeoutHoursOptions = Array.isArray(data.turnTimeoutHoursOptions) ? data.turnTimeoutHoursOptions : [];
  window.netriskTheme?.setThemes?.(state.themes.map((theme) => theme.id));
  setSelectOptions(elements.ruleSet, state.ruleSets.map((ruleSet) => ({ value: ruleSet.id, label: ruleSet.name })));
  refreshSelectableCatalogs();
  setSelectOptions(elements.turnTimeoutHours, state.turnTimeoutHoursOptions.map((hours) => ({
    value: String(hours),
    label: t("newGame.turnTimeout.option", { hours })
  })));
  renderContentPackSummary();
  renderModuleOptions();
  renderRuleSetSummary();
  renderMapDetails();
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");

    if (!response.ok) {
      throw new Error(t("auth.sessionExpired"));
    }

    const data = await response.json() as LoginResponse;
    state.user = data.user;
    window.netriskTheme?.applyUserTheme?.(state.user);
  } catch (_error: unknown) {
    state.user = null;
  }

  setHidden(elements.logoutButton, !state.user);
  if (elements.headerLoginForm) {
    const isAuthenticated = Boolean(state.user);
    setHidden(elements.headerLoginForm as HTMLElement, isAuthenticated);
    if (elements.headerAuthUsername) {
      setDisabled(elements.headerAuthUsername, isAuthenticated);
    }
    if (elements.headerAuthPassword) {
      setDisabled(elements.headerAuthPassword, isAuthenticated);
    }
    if (elements.headerLoginButton) {
      setDisabled(elements.headerLoginButton, isAuthenticated);
    }
  }
  elements.authStatus.textContent = state.user
    ? t("newGame.auth.commander", { username: state.user.username })
    : t("newGame.authStatus");
  if (state.user) {
    setHeaderAuthFeedback("");
  }
  renderNavAvatar(state.user?.username);
  state.sessionReady = true;
  updateSubmitState();
}

async function loginWithCredentials(username: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
    const data = await response.json() as LoginResponse;
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.loginFailed")));
  }

  state.user = data.user;
  window.netriskTheme?.applyUserTheme?.(state.user);
  if (elements.headerAuthPassword) {
    elements.headerAuthPassword.value = "";
  }
  await restoreSession();
}

elements.contentPack.addEventListener("change", () => {
  dropSelectedGamePreset();
  syncContentPackDefaults();
  renderContentPackSummary();
  renderRuleSetSummary();
  renderMapDetails();
});

elements.totalPlayers.addEventListener("change", renderSlots);
elements.ruleSet.addEventListener("change", () => {
  dropSelectedGamePreset();
  syncRuleSetDefaults();
  renderMapDetails();
  renderRuleSetSummary();
});
elements.map.addEventListener("change", () => {
  dropSelectedGamePreset();
  renderMapDetails();
  renderRuleSetSummary();
});
elements.customizeOptions.addEventListener("change", renderAdvancedOptions);
elements.diceRuleSet.addEventListener("change", () => {
  dropSelectedGamePreset();
  renderRuleSetSummary();
});
elements.victoryRuleSet.addEventListener("change", () => {
  dropSelectedGamePreset();
  renderRuleSetSummary();
});
elements.theme.addEventListener("change", () => {
  dropSelectedGamePreset();
  renderRuleSetSummary();
});
elements.pieceSkin.addEventListener("change", () => {
  dropSelectedGamePreset();
  renderRuleSetSummary();
});
elements.advancedOptions.addEventListener("change", (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  if (target.matches("[data-module-checkbox]")) {
    state.selectedGamePresetId = null;
    renderModuleOptions();
    refreshSelectableCatalogs();
    renderContentPackSummary();
    renderMapDetails();
    renderRuleSetSummary();
    return;
  }

  if (target.matches("#setup-game-preset")) {
    applySelectedGamePreset((target as HTMLSelectElement).value);
    return;
  }

  if (target.matches("#setup-content-profile, #setup-gameplay-profile, #setup-ui-profile")) {
    state.selectedGamePresetId = null;
    renderModuleOptions();
    return;
  }

  if (target.matches("#setup-content-profile, #setup-gameplay-profile, #setup-ui-profile")) {
    renderRuleSetSummary();
  }
});
elements.playerSlots.addEventListener("change", (event: Event) => {
  const trigger = closest(event.target, '[data-role="type"]');
  if (!trigger) {
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
    if (!data.game?.id) {
      throw new Error(t("newGame.errors.submitFailed"));
    }

    window.location.href = "/game.html?gameId=" + encodeURIComponent(data.game.id);
  } catch (error: unknown) {
    setFeedback(messageFromError(error, t("newGame.errors.submitFailed")), "error");
  } finally {
    state.creating = false;
    updateSubmitState();
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", {});
  } catch (_error: unknown) {
  }

  state.user = null;
  state.sessionReady = true;
  setHidden(elements.logoutButton, true);
  elements.authStatus.textContent = t("newGame.authStatus");
  renderNavAvatar();
  updateSubmitState();
});

if (elements.headerLoginForm) {
  (elements.headerLoginForm as HTMLElement).dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername?.value.trim() || "";
    const password = elements.headerAuthPassword?.value || "";
    if (!username || !password) {
      setHeaderAuthFeedback(t("auth.login.requiredFields"));
      return;
    }

    try {
      setHeaderAuthFeedback("");
      await loginWithCredentials(username, password);
    } catch (error) {
      setHeaderAuthFeedback(messageFromError(error, t("errors.loginFailed")));
    }
  });
}

await loadOptions();
renderSlots();
renderAdvancedOptions();
updateSubmitState();
await restoreSession();
void mountModuleSlotSection({
  slotId: "new-game.sidebar",
  containerId: "new-game-module-slots",
  anchor: elements.playerSlots,
  title: "Briefing moduli",
  copy: "I moduli attivi possono aggiungere pannelli dichiarativi a supporto del setup partita."
});
