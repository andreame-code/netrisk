import { STANDARD_CARD_RULE_SET_ID } from "../../cards.cjs";
import { STANDARD_DICE_RULE_SET_ID } from "../../dice.cjs";
import { DEFAULT_PLAYER_PIECE_SET_ID } from "../../player-piece-sets.cjs";
import { DEFAULT_SITE_THEME_ID } from "../../site-themes.cjs";
import { STANDARD_VICTORY_RULE_SET_ID } from "../../victory-rule-sets.cjs";
import type { ContentPack } from "./types.cjs";

export const coreContentPack: Readonly<ContentPack> = Object.freeze({
  id: "core",
  name: "Core",
  description: "Baseline NetRisk module pack with the default map, rules, theme, and player pieces.",
  defaultSiteThemeId: DEFAULT_SITE_THEME_ID,
  defaultMapId: "classic-mini",
  defaultDiceRuleSetId: STANDARD_DICE_RULE_SET_ID,
  defaultCardRuleSetId: STANDARD_CARD_RULE_SET_ID,
  defaultVictoryRuleSetId: STANDARD_VICTORY_RULE_SET_ID,
  defaultPieceSetId: DEFAULT_PLAYER_PIECE_SET_ID
});
