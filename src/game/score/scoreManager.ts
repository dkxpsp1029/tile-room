import type { LexioTile } from "../../types/lexio";

export type ChipInventory = {
  one: number;
  five: number;
  ten: number;
};

export type ScorePlayer = {
  id: string;
  nickname: string;
  tiles?: LexioTile[];
  chipScore?: number;
};

export type ScoreSettlement = {
  fromPlayerId: string;
  fromNickname: string;
  toPlayerId: string;
  toNickname: string;
  baseAmount: number;
  multiplier: number;
  amount: number;
};

export type ScoreRanking = {
  playerId: string;
  nickname: string;
  remainingTiles: number;
  twoTileCount: number;
  multiplier: number;
  chipDelta: number;
  chipScoreAfter: number;
  rank: number;
};

export type ScoreResult = {
  rankings: ScoreRanking[];
  settlements: ScoreSettlement[];
};

export const INITIAL_CHIP_INVENTORY: ChipInventory = {
  one: 4,
  five: 4,
  ten: 4,
};

export const INITIAL_CHIP_SCORE =
  INITIAL_CHIP_INVENTORY.one +
  INITIAL_CHIP_INVENTORY.five * 5 +
  INITIAL_CHIP_INVENTORY.ten * 10;

export function createChipInventoryFromScore(score: number): ChipInventory {
  const ten = Math.floor(score / 10);
  const afterTen = score % 10;
  const five = Math.floor(afterTen / 5);
  const one = afterTen % 5;

  return {
    ten,
    five,
    one,
  };
}

function getRemainingTiles(player: ScorePlayer) {
  return player.tiles?.length ?? 0;
}

function getTwoTileCount(player: ScorePlayer) {
  return (player.tiles ?? []).filter((tile) => tile.number === 2).length;
}

function getMultiplier(player: ScorePlayer) {
  return 2 ** getTwoTileCount(player);
}

function createRankMap(players: ScorePlayer[]) {
  const sortedRemainingCounts = [...new Set(players.map(getRemainingTiles))].sort(
    (a, b) => a - b
  );

  const rankMap = new Map<number, number>();

  sortedRemainingCounts.forEach((remainingTiles, index) => {
    rankMap.set(remainingTiles, index + 1);
  });

  return rankMap;
}

export function calculateScoreResult(players: ScorePlayer[]): ScoreResult {
  const chipDeltas = new Map<string, number>();

  players.forEach((player) => {
    chipDeltas.set(player.id, 0);
  });

  const settlements: ScoreSettlement[] = [];

  players.forEach((payer) => {
    const payerRemaining = getRemainingTiles(payer);
    const multiplier = getMultiplier(payer);

    players.forEach((receiver) => {
      if (payer.id === receiver.id) {
        return;
      }

      const receiverRemaining = getRemainingTiles(receiver);
      const baseAmount = payerRemaining - receiverRemaining;

      if (baseAmount <= 0) {
        return;
      }

      const amount = baseAmount * multiplier;

      chipDeltas.set(payer.id, (chipDeltas.get(payer.id) ?? 0) - amount);
      chipDeltas.set(receiver.id, (chipDeltas.get(receiver.id) ?? 0) + amount);

      settlements.push({
        fromPlayerId: payer.id,
        fromNickname: payer.nickname,
        toPlayerId: receiver.id,
        toNickname: receiver.nickname,
        baseAmount,
        multiplier,
        amount,
      });
    });
  });

  const rankMap = createRankMap(players);

  const rankings = [...players]
    .map((player) => {
      const remainingTiles = getRemainingTiles(player);
      const chipDelta = chipDeltas.get(player.id) ?? 0;
      const chipScoreAfter = (player.chipScore ?? INITIAL_CHIP_SCORE) + chipDelta;
      const twoTileCount = getTwoTileCount(player);

      return {
        playerId: player.id,
        nickname: player.nickname,
        remainingTiles,
        twoTileCount,
        multiplier: 2 ** twoTileCount,
        chipDelta,
        chipScoreAfter,
        rank: rankMap.get(remainingTiles) ?? 1,
      };
    })
    .sort((a, b) => {
      if (a.remainingTiles !== b.remainingTiles) {
        return a.remainingTiles - b.remainingTiles;
      }

      return b.chipScoreAfter - a.chipScoreAfter;
    });

  return {
    rankings,
    settlements,
  };
}
