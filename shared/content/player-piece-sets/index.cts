import { createLocalizedError } from "../../messages.cjs";
import { createModuleRegistry } from "../../module-registry.cjs";
import { classicPlayerPieceSet } from "./classic.cjs";
import type { PlayerPieceSet, PlayerPieceSetSummary } from "./types.cjs";

export const DEFAULT_PLAYER_PIECE_SET_ID = "classic";

const playerPieceSetRegistry = createModuleRegistry<PlayerPieceSet>(
  [classicPlayerPieceSet],
  {
    onMissing(pieceSetId) {
      throw createLocalizedError(
        "Unsupported player piece set.",
        "game.pieces.unsupportedSet",
        { pieceSetId }
      );
    }
  }
);

export function findPlayerPieceSet(pieceSetId: string | null | undefined): Readonly<PlayerPieceSet> | null {
  return playerPieceSetRegistry.find(pieceSetId);
}

export function getPlayerPieceSet(pieceSetId: string = DEFAULT_PLAYER_PIECE_SET_ID): Readonly<PlayerPieceSet> {
  return playerPieceSetRegistry.get(pieceSetId, DEFAULT_PLAYER_PIECE_SET_ID);
}

export function listPlayerPieceSets(): PlayerPieceSetSummary[] {
  return playerPieceSetRegistry.entries.map((pieceSet) => ({
    id: pieceSet.id,
    name: pieceSet.name,
    paletteSize: pieceSet.palette.length
  }));
}

export {
  classicPlayerPieceSet
};

export type {
  PlayerPieceSet,
  PlayerPieceSetSummary
};
