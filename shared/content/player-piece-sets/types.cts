export interface PlayerPieceSet {
  id: string;
  name: string;
  palette: readonly string[];
}

export interface PlayerPieceSetSummary {
  id: string;
  name: string;
  paletteSize: number;
}
