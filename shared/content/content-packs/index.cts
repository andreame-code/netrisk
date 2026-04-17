import { findCardRuleSet } from "../../cards.cjs";
import { findDiceRuleSet } from "../../dice.cjs";
import { createLocalizedError } from "../../messages.cjs";
import { createModuleRegistry } from "../../module-registry.cjs";
import { findSupportedMap } from "../../maps/index.cjs";
import { findPlayerPieceSet } from "../../player-piece-sets.cjs";
import { findSiteTheme } from "../../site-themes.cjs";
import { findVictoryRuleSet } from "../../victory-rule-sets.cjs";
import { coreContentPack } from "./core.cjs";
import type { ContentPack, ContentPackSummary } from "./types.cjs";

export const DEFAULT_CONTENT_PACK_ID = "core";

function validateContentPack(pack: ContentPack): ContentPack {
  if (!findSiteTheme(pack.defaultSiteThemeId)) {
    throw new Error(
      `Content pack "${pack.id}" references unknown site theme "${pack.defaultSiteThemeId}".`
    );
  }

  if (!findSupportedMap(pack.defaultMapId)) {
    throw new Error(`Content pack "${pack.id}" references unknown map "${pack.defaultMapId}".`);
  }

  if (!findDiceRuleSet(pack.defaultDiceRuleSetId)) {
    throw new Error(
      `Content pack "${pack.id}" references unknown dice rule set "${pack.defaultDiceRuleSetId}".`
    );
  }

  if (!findCardRuleSet(pack.defaultCardRuleSetId)) {
    throw new Error(
      `Content pack "${pack.id}" references unknown card rule set "${pack.defaultCardRuleSetId}".`
    );
  }

  if (!findVictoryRuleSet(pack.defaultVictoryRuleSetId)) {
    throw new Error(
      `Content pack "${pack.id}" references unknown victory rule set "${pack.defaultVictoryRuleSetId}".`
    );
  }

  if (!findPlayerPieceSet(pack.defaultPieceSetId)) {
    throw new Error(
      `Content pack "${pack.id}" references unknown player piece set "${pack.defaultPieceSetId}".`
    );
  }

  return pack;
}

const contentPackRegistry = createModuleRegistry<ContentPack>(
  [validateContentPack(coreContentPack)],
  {
    onMissing(contentPackId) {
      throw createLocalizedError("Unsupported content pack.", "contentPack.unsupported", {
        contentPackId
      });
    }
  }
);

export function findContentPack(
  contentPackId: string | null | undefined
): Readonly<ContentPack> | null {
  return contentPackRegistry.find(contentPackId);
}

export function getContentPack(
  contentPackId: string = DEFAULT_CONTENT_PACK_ID
): Readonly<ContentPack> {
  return contentPackRegistry.get(contentPackId, DEFAULT_CONTENT_PACK_ID);
}

export function listContentPacks(): ContentPackSummary[] {
  return contentPackRegistry.entries.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    defaultSiteThemeId: pack.defaultSiteThemeId,
    defaultMapId: pack.defaultMapId,
    defaultDiceRuleSetId: pack.defaultDiceRuleSetId,
    defaultCardRuleSetId: pack.defaultCardRuleSetId,
    defaultVictoryRuleSetId: pack.defaultVictoryRuleSetId,
    defaultPieceSetId: pack.defaultPieceSetId
  }));
}

export { coreContentPack };

export type { ContentPack, ContentPackSummary };
