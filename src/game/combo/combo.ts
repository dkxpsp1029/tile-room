import type { LexioTile } from "../../types/lexio";

export type ComboType =
  | "single"
  | "pair"
  | "triple"
  | "straight"
  | "flush"
  | "fullHouse"
  | "fourCard"
  | "straightFlush";

export type ComboResult = {
  type: ComboType;
  tiles: LexioTile[];
  rank: number;
  suitRank: number;
  size: number;
};

export const COMBO_LABELS: Record<ComboType, string> = {
  single: "SINGLE",
  pair: "PAIR",
  triple: "TRIPLE",
  straight: "STRAIGHT",
  flush: "FLUSH",
  fullHouse: "FULL HOUSE",
  fourCard: "FOUR CARD",
  straightFlush: "STRAIGHT FLUSH",
};

const NUMBER_RANK: Record<number, number> = {
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
  9: 7,
  10: 8,
  11: 9,
  12: 10,
  13: 11,
  14: 12,
  15: 13,
  1: 14,
  2: 15,
};

const SUIT_RANK = {
  cloud: 1,
  star: 2,
  moon: 3,
  sun: 4,
} as const;

const FIVE_CARD_TYPE_RANK: Record<
  Extract<ComboType, "straight" | "flush" | "fullHouse" | "fourCard" | "straightFlush">,
  number
> = {
  straight: 1,
  flush: 2,
  fullHouse: 3,
  fourCard: 4,
  straightFlush: 5,
};

export function getNumberRank(number: number) {
  return NUMBER_RANK[number] ?? 0;
}

export function getSuitRank(tile: LexioTile) {
  return SUIT_RANK[tile.suit];
}

export function getComboLabel(type: ComboType) {
  return COMBO_LABELS[type];
}

function getHighestTile(tiles: LexioTile[]) {
  return [...tiles].sort((a, b) => {
    const numberDiff = getNumberRank(b.number) - getNumberRank(a.number);

    if (numberDiff !== 0) {
      return numberDiff;
    }

    return getSuitRank(b) - getSuitRank(a);
  })[0];
}

function getNumberCounts(tiles: LexioTile[]) {
  const counts = new Map<number, LexioTile[]>();

  tiles.forEach((tile) => {
    const currentTiles = counts.get(tile.number) ?? [];
    counts.set(tile.number, [...currentTiles, tile]);
  });

  return counts;
}

function isStraight(tiles: LexioTile[]) {
  const uniqueRanks = [...new Set(tiles.map((tile) => getNumberRank(tile.number)))];

  if (uniqueRanks.length !== 5) {
    return false;
  }

  const sortedRanks = [...uniqueRanks].sort((a, b) => a - b);

  return sortedRanks.every((rank, index) => {
    if (index === 0) {
      return true;
    }

    return rank === sortedRanks[index - 1] + 1;
  });
}

function isFlush(tiles: LexioTile[]) {
  return tiles.length > 0 && tiles.every((tile) => tile.suit === tiles[0].suit);
}

export function analyzeCombo(tiles: LexioTile[]): ComboResult | null {
  if (![1, 2, 3, 5].includes(tiles.length)) {
    return null;
  }

  const numberCounts = getNumberCounts(tiles);
  const highestTile = getHighestTile(tiles);

  if (!highestTile) {
    return null;
  }

  if (tiles.length === 1) {
    return {
      type: "single",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 1,
    };
  }

  if (tiles.length === 2) {
    if (numberCounts.size !== 1) {
      return null;
    }

    return {
      type: "pair",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 2,
    };
  }

  if (tiles.length === 3) {
    if (numberCounts.size !== 1) {
      return null;
    }

    return {
      type: "triple",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 3,
    };
  }

  const straight = isStraight(tiles);
  const flush = isFlush(tiles);

  if (straight && flush) {
    return {
      type: "straightFlush",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 5,
    };
  }

  const countValues = [...numberCounts.values()].map((group) => group.length);

  if (countValues.includes(4)) {
    const fourCardTiles = [...numberCounts.values()].find(
      (group) => group.length === 4
    );

    if (!fourCardTiles) {
      return null;
    }

    const representativeTile = getHighestTile(fourCardTiles);

    return {
      type: "fourCard",
      tiles,
      rank: getNumberRank(representativeTile.number),
      suitRank: getSuitRank(representativeTile),
      size: 5,
    };
  }

  if (countValues.includes(3) && countValues.includes(2)) {
    const tripleTiles = [...numberCounts.values()].find(
      (group) => group.length === 3
    );

    if (!tripleTiles) {
      return null;
    }

    const representativeTile = getHighestTile(tripleTiles);

    return {
      type: "fullHouse",
      tiles,
      rank: getNumberRank(representativeTile.number),
      suitRank: getSuitRank(representativeTile),
      size: 5,
    };
  }

  if (flush) {
    return {
      type: "flush",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 5,
    };
  }

  if (straight) {
    return {
      type: "straight",
      tiles,
      rank: getNumberRank(highestTile.number),
      suitRank: getSuitRank(highestTile),
      size: 5,
    };
  }

  return null;
}

export function compareCombos(nextCombo: ComboResult, currentCombo: ComboResult) {
  if (nextCombo.size !== currentCombo.size) {
    return false;
  }

  if (nextCombo.size !== 5 && nextCombo.type !== currentCombo.type) {
    return false;
  }

  if (nextCombo.size === 5) {
    const nextTypeRank = FIVE_CARD_TYPE_RANK[nextCombo.type as keyof typeof FIVE_CARD_TYPE_RANK];
    const currentTypeRank =
      FIVE_CARD_TYPE_RANK[currentCombo.type as keyof typeof FIVE_CARD_TYPE_RANK];

    if (nextTypeRank !== currentTypeRank) {
      return nextTypeRank > currentTypeRank;
    }
  }

  if (nextCombo.rank !== currentCombo.rank) {
    return nextCombo.rank > currentCombo.rank;
  }

  return nextCombo.suitRank > currentCombo.suitRank;
}
