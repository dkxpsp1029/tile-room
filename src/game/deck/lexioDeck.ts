import type { LexioSuit, LexioTile } from "../../types/lexio";

const SUITS: LexioSuit[] = ["cloud", "star", "moon", "sun"];

const LEXIO_PLAYER_RULES: Record<number, { maxNumber: number }> = {
  3: { maxNumber: 9 },
  4: { maxNumber: 13 },
  5: { maxNumber: 15 },
};

function shuffleTiles(tiles: LexioTile[]): LexioTile[] {
  return [...tiles].sort(() => Math.random() - 0.5);
}

export function createLexioDeck(playerCount: number): LexioTile[] {
  const rule = LEXIO_PLAYER_RULES[playerCount];

  if (!rule) {
    throw new Error("렉시오는 3~5인만 플레이할 수 있습니다.");
  }

  const tiles: LexioTile[] = [];

  for (let number = 1; number <= rule.maxNumber; number += 1) {
    for (const suit of SUITS) {
      tiles.push({
        id: `${suit}-${number}`,
        suit,
        number,
      });
    }
  }

  return tiles;
}

export function createShuffledLexioDeck(playerCount: number): LexioTile[] {
  return shuffleTiles(createLexioDeck(playerCount));
}