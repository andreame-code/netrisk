import type { PlayerPieceSet } from "./types.cjs";

export const classicPlayerPieceSet: Readonly<PlayerPieceSet> = Object.freeze({
  id: "classic",
  name: "Classic",
  palette: Object.freeze(["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"])
});
