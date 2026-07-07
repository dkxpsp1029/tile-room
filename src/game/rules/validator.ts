import type { LexioTile } from "../../types/lexio";
import { analyzeCombo, compareCombos, type ComboResult } from "../combo/combo";

export type PlayValidationResult =
  | {
      ok: true;
      combo: ComboResult;
    }
  | {
      ok: false;
      reason: string;
      combo?: ComboResult;
    };

type ValidatePlayParams = {
  selectedTiles: LexioTile[];
  currentCombo: ComboResult | null;
};

function getInvalidReason(tileCount: number) {
  if (tileCount === 0) {
    return "낼 타일을 선택해주세요.";
  }

  if (![1, 2, 3, 5].includes(tileCount)) {
    return "렉시오는 1장, 2장, 3장, 5장 조합만 낼 수 있습니다.";
  }

  if (tileCount === 2) {
    return "2장은 같은 숫자 페어만 낼 수 있습니다.";
  }

  if (tileCount === 3) {
    return "3장은 같은 숫자 트리플만 낼 수 있습니다.";
  }

  if (tileCount === 5) {
    return "5장은 스트레이트, 플러시, 풀하우스, 포카드, 스트레이트 플러시만 낼 수 있습니다.";
  }

  return "유효하지 않은 조합입니다.";
}

export function validatePlay({
  selectedTiles,
  currentCombo,
}: ValidatePlayParams): PlayValidationResult {
  const nextCombo = analyzeCombo(selectedTiles);

  if (!nextCombo) {
    return {
      ok: false,
      reason: getInvalidReason(selectedTiles.length),
    };
  }

  if (!currentCombo) {
    return {
      ok: true,
      combo: nextCombo,
    };
  }

  const canBeat = compareCombos(nextCombo, currentCombo);

  if (!canBeat) {
    return {
      ok: false,
      reason: "현재 바닥 패보다 높은 조합을 내야 합니다.",
      combo: nextCombo,
    };
  }

  return {
    ok: true,
    combo: nextCombo,
  };
}
