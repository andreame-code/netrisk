export {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
} from "./core-domain.cjs";
export type {
  Continent,
  CreateContinentInput,
  CreateGameStateInput,
  GameConfig,
  CreatePlayerInput,
  CreateTerritoryInput,
  GameState,
  MapPosition,
  Player,
  Territory,
  TerritoryState,
  TurnPhaseValue
} from "./core-domain.cjs";
export {
  DEFENSE_THREE_DICE_RULE_SET_ID,
  STANDARD_DICE_RULE_SET_ID,
  defenseThreeDiceRuleSet,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet
} from "./dice.cjs";
export {
  DEFAULT_EXTENSION_PACK_ID,
  DEFAULT_PIECE_SKIN_ID,
  DEFAULT_THEME_ID,
  DEFAULT_VICTORY_RULE_SET_ID,
  EXTENSION_SCHEMA_VERSION,
  MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
  findExtensionPack,
  findPieceSkin,
  findVictoryRuleSet,
  findVisualTheme,
  getExtensionPack,
  getPieceSkin,
  getVictoryRuleSet,
  getVisualTheme,
  listExtensionPacks,
  listPieceSkins,
  listSupportedThemeIds,
  listVictoryRuleSets,
  listVisualThemes,
  migrateGameConfigExtensions,
  migrateGameStateExtensions,
  normalizeExtensionSelection,
  resolveStoredThemeId,
  validateExtensionPackCatalog
} from "./extensions.cjs";
export type {
  ExtensionCatalogValidationResult,
  ExtensionAwareGameConfig,
  ExtensionPackManifest,
  ExtensionPackSummary,
  ExtensionSelection,
  MapDefinition,
  PieceSkin,
  VictoryRuleSet,
  VisualTheme
} from "./extensions.cjs";
export {
  CardType,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  createCard,
  findCardRuleSet,
  createStandardDeck,
  getCardRuleSet,
  listCardRuleSets,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
} from "./cards.cjs";
export type {
  Card,
  CardRuleSet,
  CardRuleSetSummary,
  CardSetValidationResult,
  CardTypeValue,
  CreateCardInput,
  CreateDeckOptions,
  NonWildCardType,
  ValidCardSet
} from "./cards.cjs";
export {
  STANDARD_COMBAT_RULE_SET_ID,
  findCombatRuleSet,
  getCombatRuleSet,
  listCombatRuleSets,
  standardCombatRuleSet
} from "./combat-rule-sets.cjs";
export type {
  CombatComparisonLike,
  CombatOutcome,
  CombatRuleSet,
  CombatRuleSetSummary
} from "./combat-rule-sets.cjs";
export {
  STANDARD_REINFORCEMENT_RULE_SET_ID,
  findReinforcementRuleSet,
  getReinforcementRuleSet,
  listReinforcementRuleSets,
  standardReinforcementRuleSet
} from "./reinforcement-rule-sets.cjs";
export type {
  ReinforcementBonus,
  ReinforcementResolution,
  ReinforcementRuleSet,
  ReinforcementRuleSetSummary
} from "./reinforcement-rule-sets.cjs";
export {
  STANDARD_FORTIFY_RULE_SET_ID,
  findFortifyRuleSet,
  getFortifyRuleSet,
  listFortifyRuleSets,
  standardFortifyRuleSet
} from "./fortify-rule-sets.cjs";
export type {
  FortifyRuleSet,
  FortifyRuleSetSummary
} from "./fortify-rule-sets.cjs";
export {
  DEFAULT_CONTENT_PACK_ID,
  coreContentPack,
  findContentPack,
  getContentPack,
  listContentPacks
} from "./content-packs.cjs";
export type {
  ContentPack,
  ContentPackSummary
} from "./content-packs.cjs";
export {
  DEFAULT_SITE_THEME_ID,
  commandSiteTheme,
  emberSiteTheme,
  findSiteTheme,
  getSiteTheme,
  listSiteThemes,
  midnightSiteTheme
} from "./site-themes.cjs";
export type {
  SiteTheme,
  SiteThemeSummary
} from "./site-themes.cjs";
export {
  DEFAULT_PLAYER_PIECE_SET_ID,
  classicPlayerPieceSet,
  findPlayerPieceSet,
  getPlayerPieceSet,
  listPlayerPieceSets
} from "./player-piece-sets.cjs";
export type {
  PlayerPieceSet,
  PlayerPieceSetSummary
} from "./player-piece-sets.cjs";
export { listContentModules } from "./content-catalog.cjs";
export type { ContentModuleKind, ContentModuleSummary } from "./content-catalog.cjs";
export { GameAction } from "./game-actions.cjs";
export type { GameActionValue } from "./game-actions.cjs";
export {
  createActionFailure,
  createDomainFailure,
  createLogEntry,
  createLocalizedError,
  createValidationFailure
} from "./messages.cjs";
export type {
  ActionFailure,
  DomainFailure,
  LocalizedError,
  LogEntry,
  MessageParams,
  ValidationFailure
} from "./messages.cjs";
