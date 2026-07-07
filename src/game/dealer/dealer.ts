import type { LexioTile } from "../../types/lexio";
import { createShuffledLexioDeck } from "../deck/lexioDeck";

export function dealTiles(playerIds: string[]): Record<string, LexioTile[]> {
  const playerCount = playerIds.length;

  if (playerCount < 3 || playerCount > 5) {
    throw new Error("렉시오는 3~5인만 플레이할 수 있습니다.");
  }

  const deck = createShuffledLexioDeck(playerCount);

  const result: Record<string, LexioTile[]> = {};

  playerIds.forEach((id) => {
    result[id] = [];
  });

  deck.forEach((tile, index) => {
    const playerId = playerIds[index % playerCount];
    result[playerId].push(tile);
  });

  return result;
}