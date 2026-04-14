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
  resolveStoredThemeId
} from "./extensions.cjs";
export type {
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
  createStandardDeck,
  getCardRuleSet,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
} from "./cards.cjs";
export type {
  Card,
  CardRuleSet,
  CardSetValidationResult,
  CardTypeValue,
  CreateCardInput,
  CreateDeckOptions,
  NonWildCardType,
  ValidCardSet
} from "./cards.cjs";
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
