import { useEffect, useMemo, useRef, useState } from "react";

import "./GamePage.css";

import {
  leaveRoom,
  passTurn,
  playTiles,
  setReplayReady,
  startReplayIfReady,
  subscribeRoom,
  type RoomData,
} from "../services/roomService";
import { analyzeCombo, getComboLabel } from "../game/combo/combo";
import { validatePlay } from "../game/rules/validator";
import type { LexioTile } from "../types/lexio";

type GamePageProps = {
  nickname: string;
  roomCode: string;
  playerId: string;
  onLeaveComplete: () => void;
};

const suitSymbols = {
  sun: "☀",
  moon: "🌙",
  star: "★",
  cloud: "☁",
};

const REPLAY_COUNTDOWN_MS = 3000;
const WINNER_SPLASH_MS = 1200;

function sortTiles(tiles: LexioTile[]) {
  return [...tiles].sort((a, b) => {
    if (a.number !== b.number) {
      return a.number - b.number;
    }

    return a.suit.localeCompare(b.suit);
  });
}

function playBeep(type: "tile" | "turn" | "victory" | "start") {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    const settings = {
      tile: { frequency: 520, duration: 0.08, volume: 0.04, type: "square" as OscillatorType },
      turn: { frequency: 740, duration: 0.1, volume: 0.035, type: "triangle" as OscillatorType },
      victory: { frequency: 980, duration: 0.24, volume: 0.05, type: "square" as OscillatorType },
      start: { frequency: 660, duration: 0.16, volume: 0.045, type: "sawtooth" as OscillatorType },
    }[type];

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      settings.frequency * 1.35,
      audioContext.currentTime + settings.duration
    );

    gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + settings.duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + settings.duration);
  } catch {
    // 브라우저 오디오 정책 때문에 실패해도 게임 진행에는 영향 없음.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export default function GamePage({
  nickname,
  roomCode,
  playerId,
  onLeaveComplete,
}: GamePageProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [showWinnerSplash, setShowWinnerSplash] = useState(false);

  const previousTurnPlayerIdRef = useRef<string | null>(null);
  const previousTableTileIdsRef = useRef<string>("");
  const previousStatusRef = useRef<RoomData["status"] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRoom(roomCode, setRoom);

    return () => {
      unsubscribe();
    };
  }, [roomCode]);

  const currentPlayer = room?.players.find((player) => player.id === playerId);

  const currentTurnPlayer = room?.players.find(
    (player) => player.id === room.game?.currentTurnPlayerId
  );

  const currentTurnPlayerId = room?.game?.currentTurnPlayerId;
  const winnerPlayerId = room?.game?.winnerPlayerId;
  const replayReadyPlayerIds = room?.game?.replayReadyPlayerIds ?? [];
  const replayCountdownStartedAt = room?.game?.replayCountdownStartedAt ?? null;

  const isGameFinished = room?.status === "finished";
  const winnerPlayer = room?.players.find((player) => player.id === winnerPlayerId);

  const rankedPlayers = useMemo(() => {
    const scoreRankings = room?.game?.scoreResult?.rankings;

    if (scoreRankings?.length) {
      return [...(room?.players ?? [])].sort((a, b) => {
        const aRanking = scoreRankings.find((item) => item.playerId === a.id);
        const bRanking = scoreRankings.find((item) => item.playerId === b.id);

        return (aRanking?.rank ?? 99) - (bRanking?.rank ?? 99);
      });
    }

    return [...(room?.players ?? [])].sort((a, b) => {
      if (a.id === winnerPlayerId) return -1;
      if (b.id === winnerPlayerId) return 1;

      return (a.tiles?.length ?? 0) - (b.tiles?.length ?? 0);
    });
  }, [room?.players, room?.game?.scoreResult?.rankings, winnerPlayerId]);

  const scoreResult = room?.game?.scoreResult ?? null;
  const settlements = scoreResult?.settlements ?? [];
  const scoreRankingMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scoreResult>["rankings"][number]>();

    scoreResult?.rankings.forEach((ranking) => {
      map.set(ranking.playerId, ranking);
    });

    return map;
  }, [scoreResult]);

  const isMyTurn =
    !!currentPlayer &&
    !!room?.game &&
    currentPlayer.id === currentTurnPlayerId;

  const canAct = isMyTurn && room?.status === "playing" && !isSubmitting;

  const myTiles = sortTiles(currentPlayer?.tiles ?? []);
  const tableTiles = room?.game?.tableTiles ?? [];
  const selectedTiles = myTiles.filter((tile) => selectedTileIds.includes(tile.id));
  const selectedCombo = selectedTiles.length > 0 ? analyzeCombo(selectedTiles) : null;
  const selectedValidation = selectedTiles.length > 0
    ? validatePlay({
        selectedTiles,
        currentCombo: room?.game?.currentCombo ?? null,
      })
    : null;
  const canSubmitSelectedCombo = !!selectedValidation?.ok;
  const selectedComboError = selectedValidation?.ok === false
    ? selectedValidation.reason
    : null;

  const readyCount = room?.players.filter((player) => replayReadyPlayerIds.includes(player.id)).length ?? 0;
  const totalPlayerCount = room?.players.length ?? 0;
  const isReplayReady = !!currentPlayer && replayReadyPlayerIds.includes(currentPlayer.id);
  const allReplayReady = totalPlayerCount > 0 && readyCount === totalPlayerCount;
  const canReplayWithCurrentPlayers = totalPlayerCount >= 3;

  useEffect(() => {
    if (!room?.game) {
      return;
    }

    const currentTableTileIds = room.game.tableTiles.map((tile) => tile.id).join("|");

    if (
      previousTableTileIdsRef.current &&
      previousTableTileIdsRef.current !== currentTableTileIds &&
      currentTableTileIds.length > 0
    ) {
      playBeep("tile");
    }

    if (
      previousTurnPlayerIdRef.current &&
      previousTurnPlayerIdRef.current !== room.game.currentTurnPlayerId &&
      room.status === "playing"
    ) {
      playBeep("turn");
    }

    if (previousStatusRef.current !== "finished" && room.status === "finished") {
      playBeep("victory");
      setShowWinnerSplash(true);

      window.setTimeout(() => {
        setShowWinnerSplash(false);
      }, WINNER_SPLASH_MS);
    }

    if (previousStatusRef.current === "finished" && room.status === "playing") {
      playBeep("start");
      setCountdownValue(null);
      setShowWinnerSplash(false);
    }

    previousTableTileIdsRef.current = currentTableTileIds;
    previousTurnPlayerIdRef.current = room.game.currentTurnPlayerId;
    previousStatusRef.current = room.status;
  }, [room]);

  useEffect(() => {
    if (!isGameFinished || !replayCountdownStartedAt || !allReplayReady) {
      setCountdownValue(null);
      return;
    }

    const updateCountdown = () => {
      const elapsed = Date.now() - replayCountdownStartedAt;
      const remainingMs = Math.max(0, REPLAY_COUNTDOWN_MS - elapsed);
      const nextValue = Math.max(1, Math.ceil(remainingMs / 1000));

      setCountdownValue(remainingMs === 0 ? 0 : nextValue);

      if (remainingMs === 0) {
        startReplayIfReady({ roomCode }).catch((error) => {
          console.error(error);
        });
      }
    };

    updateCountdown();

    const intervalId = window.setInterval(updateCountdown, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [allReplayReady, isGameFinished, replayCountdownStartedAt, roomCode]);

  const toggleTile = (tileId: string) => {
    if (!canAct) {
      return;
    }

    setSelectedTileIds((prev) =>
      prev.includes(tileId)
        ? prev.filter((id) => id !== tileId)
        : [...prev, tileId]
    );
  };

  const handleSubmitTiles = async () => {
    if (!currentPlayer) {
      alert("플레이어 정보를 찾을 수 없습니다.");
      return;
    }

    if (!canAct) {
      alert("아직 내 차례가 아닙니다.");
      return;
    }

    if (selectedTileIds.length === 0) {
      alert("낼 타일을 선택해주세요.");
      return;
    }

    if (!canSubmitSelectedCombo) {
      alert(selectedValidation?.ok === false ? selectedValidation.reason : "유효하지 않은 조합입니다.");
      return;
    }

    try {
      setIsSubmitting(true);

      await playTiles({
        roomCode,
        playerId: currentPlayer.id,
        selectedTileIds,
      });

      setSelectedTileIds([]);
      playBeep("tile");
    } catch (error) {
      alert(error instanceof Error ? error.message : "패 내기에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePass = async () => {
    if (!currentPlayer) {
      alert("플레이어 정보를 찾을 수 없습니다.");
      return;
    }

    if (!canAct) {
      alert("아직 내 차례가 아닙니다.");
      return;
    }

    try {
      setIsSubmitting(true);

      await passTurn({
        roomCode,
        playerId: currentPlayer.id,
      });

      setSelectedTileIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "PASS에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentPlayer) {
      alert("플레이어 정보를 찾을 수 없습니다.");
      return;
    }

    const confirmed = window.confirm("정말 방을 나가시겠습니까?");

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);

      await leaveRoom({
        roomCode,
        playerId: currentPlayer.id,
      });

      onLeaveComplete();
    } catch (error) {
      alert(error instanceof Error ? error.message : "방 나가기에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplayReady = async () => {
    if (!currentPlayer) {
      alert("플레이어 정보를 찾을 수 없습니다.");
      return;
    }

    if (!canReplayWithCurrentPlayers) {
      alert("다시 시작하려면 최소 3명이 필요합니다.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSelectedTileIds([]);

      await setReplayReady({
        roomCode,
        playerId: currentPlayer.id,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "다시하기 준비에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lexio-screen">
      <header className="lexio-header">
        <h1>LEXIO SYSTEM</h1>
        <p>
          ROOM {roomCode} · {nickname}
        </p>

        <button
          className="game-leave-button"
          disabled={isSubmitting}
          onClick={handleLeaveRoom}
        >
          방 나가기
        </button>

        <div className={isMyTurn ? "turn-banner my-turn" : "turn-banner"}>
          {isGameFinished
            ? `GAME OVER · WINNER ${winnerPlayer?.nickname ?? "확인 중"}`
            : `현재 턴: ${currentTurnPlayer?.nickname ?? "확인 중"}`}
          {!isGameFinished && isMyTurn ? " · 내 차례" : ""}
        </div>
      </header>

      <section className="opponent-area">
        <div className="opponent-list">
          {room?.players.map((player) => {
            const isMe = player.id === playerId;
            const isActiveTurn = !isGameFinished && player.id === currentTurnPlayerId;

            return (
              <div
                className={`opponent-card${isMe ? " me" : ""}${isActiveTurn ? " active-turn" : ""}`}
                key={player.id}
              >
                <span>
                  {player.nickname}
                  {isMe ? " (ME)" : ""}
                </span>
                <strong>{player.tiles?.length ?? 0}장 · {player.chipScore ?? 64}칩</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="table-area">
        {tableTiles.length === 0 ? (
          <span className="table-placeholder">여기에 패가 제출됩니다</span>
        ) : (
          tableTiles.map((tile) => (
            <div className={`lexio-tile suit-${tile.suit}`} key={tile.id}>
              <div className="tile-suit">{suitSymbols[tile.suit]}</div>
              <div className="tile-number">{tile.number}</div>
              <div className="tile-suit">{suitSymbols[tile.suit]}</div>
            </div>
          ))
        )}
      </section>

      {!isGameFinished && (
        <>
          <section className="selected-combo-panel">
            {selectedTileIds.length === 0 ? (
              <span>선택한 패 없음</span>
            ) : selectedCombo ? (
              <span className={selectedValidation?.ok ? "combo-valid" : "combo-invalid"}>
                선택 조합: {getComboLabel(selectedCombo.type)}
                {selectedValidation?.ok ? " · 제출 가능" : ` · ${selectedComboError ?? "제출 불가"}`}
              </span>
            ) : (
              <span className="combo-invalid">
                INVALID · {selectedComboError ?? "유효하지 않은 조합입니다."}
              </span>
            )}
          </section>

          <section className="game-controls">
            <button
              className="lexio-button primary"
              disabled={!canAct || !canSubmitSelectedCombo}
              onClick={handleSubmitTiles}
            >
              패 내기
            </button>

            <button
              className="lexio-button secondary"
              disabled={!canAct}
              onClick={handlePass}
            >
              PASS
            </button>
          </section>
        </>
      )}

      <section className="player-hand-container">
        <div className="player-hand">
          {myTiles.length === 0 ? (
            <p className="empty-hand">남은 타일 없음</p>
          ) : (
            myTiles.map((tile) => {
              const isSelected = selectedTileIds.includes(tile.id);

              return (
                <button
                  className={`lexio-tile suit-${tile.suit} ${
                    isSelected ? "selected" : ""
                  }`}
                  disabled={!canAct}
                  key={tile.id}
                  onClick={() => toggleTile(tile.id)}
                >
                  <div className="tile-suit">{suitSymbols[tile.suit]}</div>
                  <div className="tile-number">{tile.number}</div>
                  <div className="tile-suit">{suitSymbols[tile.suit]}</div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {showWinnerSplash && isGameFinished && (
        <div className="winner-splash">
          <div>
            <span>🏆 WINNER</span>
            <strong>{winnerPlayer?.nickname ?? "확인 중"}</strong>
          </div>
        </div>
      )}

      {isGameFinished && !showWinnerSplash && (
        <div className="game-over-backdrop">
          <section className="game-over-modal">
            <p className="game-over-kicker">ROUND FINISHED</p>
            <h2>GAME OVER</h2>

            <div className="winner-box">
              <span>🏆 WINNER</span>
              <strong>{winnerPlayer?.nickname ?? "확인 중"}</strong>
            </div>

            <div className="ranking-box">
              {rankedPlayers.map((player, index) => (
                <div className="ranking-row" key={player.id}>
                  <span>{scoreRankingMap.get(player.id)?.rank ?? index + 1}위</span>
                  <strong>
                    {player.nickname}
                    {player.id === playerId ? " (ME)" : ""}
                  </strong>
                  <em>
                    {player.tiles?.length ?? 0}장 · {player.chipScore ?? 64}칩
                    {scoreRankingMap.get(player.id) && (
                      <b className={scoreRankingMap.get(player.id)!.chipDelta >= 0 ? "chip-plus" : "chip-minus"}>
                        {scoreRankingMap.get(player.id)!.chipDelta >= 0 ? " +" : " "}
                        {scoreRankingMap.get(player.id)!.chipDelta}
                      </b>
                    )}
                  </em>
                </div>
              ))}
            </div>

            {scoreResult && (
              <div className="score-summary-box">
                <div className="score-summary-title">
                  <strong>칩 정산</strong>
                  <span>2 보유 시 지급액 배수 적용</span>
                </div>

                <div className="score-ranking-list">
                  {scoreResult.rankings.map((ranking) => (
                    <div className="score-ranking-row" key={ranking.playerId}>
                      <span>{ranking.nickname}</span>
                      <strong>{ranking.chipScoreAfter}칩</strong>
                      <em className={ranking.chipDelta >= 0 ? "chip-plus" : "chip-minus"}>
                        {ranking.chipDelta >= 0 ? "+" : ""}{ranking.chipDelta}
                      </em>
                      <small>
                        남은 패 {ranking.remainingTiles}장
                        {ranking.twoTileCount > 0
                          ? ` · 2 ${ranking.twoTileCount}장 ×${ranking.multiplier}`
                          : ""}
                      </small>
                    </div>
                  ))}
                </div>

                <div className="settlement-list">
                  {settlements.length === 0 ? (
                    <p>정산 내역 없음</p>
                  ) : (
                    settlements.map((settlement, index) => (
                      <p key={`${settlement.fromPlayerId}-${settlement.toPlayerId}-${index}`}>
                        {settlement.fromNickname} → {settlement.toNickname} : {settlement.amount}칩
                        {settlement.multiplier > 1
                          ? ` (${settlement.baseAmount} × ${settlement.multiplier})`
                          : ""}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="replay-ready-box">
              <div className="replay-ready-title">
                <strong>다음 판 준비</strong>
                <span>
                  {readyCount} / {totalPlayerCount} READY
                </span>
              </div>

              <div className="replay-ready-list">
                {room?.players.map((player) => {
                  const ready = replayReadyPlayerIds.includes(player.id);

                  return (
                    <div className={ready ? "replay-ready-row ready" : "replay-ready-row"} key={player.id}>
                      <span>
                        {player.nickname}
                        {player.id === playerId ? " (ME)" : ""}
                      </span>
                      <strong>{ready ? "READY" : "WAITING"}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {allReplayReady && replayCountdownStartedAt ? (
              <div className="countdown-box">
                <span>새 게임 시작</span>
                <strong>{countdownValue ?? 3}</strong>
              </div>
            ) : (
              <button
                className={isReplayReady ? "restart-button ready" : "restart-button"}
                disabled={isSubmitting || isReplayReady || !canReplayWithCurrentPlayers}
                onClick={handleReplayReady}
              >
                {isReplayReady ? "READY 완료" : "▶ 다시하기 READY"}
              </button>
            )}

            {!canReplayWithCurrentPlayers && (
              <p className="game-over-message">
                다시 시작하려면 최소 3명이 필요합니다.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
