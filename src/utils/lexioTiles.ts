import type { LexioSuit, LexioTile } from "../types/lexio";

const suits: LexioSuit[] = ["cloud", "star", "moon", "sun"];

export function createLexioTiles(): LexioTile[] {
  const tiles: LexioTile[] = [];

  for (const suit of suits) {
    for (let number = 1; number <= 15; number++) {
      tiles.push({
        id: `${suit}-${number}`,
        suit,
        number,
      });
    }
  }

  return tiles;
}

export function shuffleTiles(tiles: LexioTile[]): LexioTile[] {
  return [...tiles].sort(() => Math.random() - 0.5);
}