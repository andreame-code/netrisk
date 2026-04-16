import { listCardRuleSets } from "./cards.cjs";
import { listContentPacks } from "./content-packs.cjs";
import { listDiceRuleSets } from "./dice.cjs";
import { listSupportedMaps } from "./maps/index.cjs";
import { listPlayerPieceSets } from "./player-piece-sets.cjs";
import { listSiteThemes } from "./site-themes.cjs";
import { listVictoryRuleSets } from "./victory-rule-sets.cjs";

export type ContentModuleKind =
  | "site-theme"
  | "dice-rule-set"
  | "card-rule-set"
  | "victory-rule-set"
  | "map"
  | "player-piece-set"
  | "content-pack";

export interface ContentModuleSummary {
  id: string;
  name: string;
  kind: ContentModuleKind;
}

export function listContentModules(): ContentModuleSummary[] {
  return [
    ...listSiteThemes().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "site-theme" as const
    })),
    ...listDiceRuleSets().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "dice-rule-set" as const
    })),
    ...listCardRuleSets().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "card-rule-set" as const
    })),
    ...listVictoryRuleSets().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "victory-rule-set" as const
    })),
    ...listSupportedMaps().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "map" as const
    })),
    ...listPlayerPieceSets().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "player-piece-set" as const
    })),
    ...listContentPacks().map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "content-pack" as const
    }))
  ];
}
