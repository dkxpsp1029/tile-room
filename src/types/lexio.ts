export type LexioSuit = "cloud" | "star" | "moon" | "sun";

export type LexioTile = {
  id: string;
  number: number;
  suit: LexioSuit;
};

export type LexioPlayer = {
  id: string;
  nickname: string;
  role: "host" | "player";
  isReady: boolean;
  tiles: LexioTile[];
  score: number;
  joinedAt: number;
};

export type LexioComboType =
  | "single"
  | "pair"
  | "triple"
  | "straight"
  | "flush"
  | "fullHouse"
  | "fourCard"
  | "straightFlush";

export type LexioCombo = {
  type: LexioComboType;
  tiles: LexioTile[];
  ownerPlayerId: string;
  rankValue: number;
};

export type LexioGameState = {
  round: number;
  currentTurnPlayerId: string;
  currentCombo: LexioCombo | null;
  passPlayerIds: string[];
  lastPlayedPlayerId: string | null;
  winnerPlayerId: string | null;
};