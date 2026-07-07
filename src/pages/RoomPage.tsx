import { useEffect, useState } from "react";

import "./RoomPage.css";

import {
  leaveRoom,
  setPlayerReady,
  startGame,
  subscribeRoom,
  type RoomData,
} from "../services/roomService";

type RoomPageProps = {
  nickname: string;
  roomCode: string;
  playerId: string;
  onBack: () => void;
  onGameStart: () => void;
  onLeaveComplete: () => void;
};

export default function RoomPage({
  nickname,
  roomCode,
  playerId,
  onBack,
  onGameStart,
  onLeaveComplete,
}: RoomPageProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isReadyChanging, setIsReadyChanging] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRoom(roomCode, (roomData) => {
      setRoom(roomData);
      setIsLoading(false);

      if (roomData?.status === "playing") {
        onGameStart();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, onGameStart]);

  if (isLoading) {
    return (
      <div className="room-screen">
        <div className="room-panel">
          <h1 className="room-title">LOADING...</h1>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-screen">
        <div className="room-panel">
          <h1 className="room-title">ROOM NOT FOUND</h1>

          <button className="start-button" onClick={onBack}>
            ◀ BACK
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = room.players.find((player) => player.id === playerId);
  const isHost = currentPlayer?.role === "host";
  const waitingSlots = room.maxPlayers - room.players.length;
  const hasEnoughPlayers = room.players.length >= 3;
  const allReady = room.players.every((player) => player.isReady);
  const canStart = hasEnoughPlayers && allReady;

  const handleStartGame = async () => {
    if (isStarting || !canStart) {
      return;
    }

    try {
      setIsStarting(true);
      await startGame(roomCode);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "게임 시작에 실패했습니다.");
    } finally {
      setIsStarting(false);
    }
  };


  const handleLeaveRoom = async () => {
    if (!currentPlayer || isLeaving) {
      return;
    }

    const confirmed = window.confirm("정말 방을 나가시겠습니까?");

    if (!confirmed) {
      return;
    }

    try {
      setIsLeaving(true);

      await leaveRoom({
        roomCode,
        playerId: currentPlayer.id,
      });

      onLeaveComplete();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "방 나가기에 실패했습니다.");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleReadyToggle = async () => {
    if (!currentPlayer || currentPlayer.role === "host" || isReadyChanging) {
      return;
    }

    try {
      setIsReadyChanging(true);

      await setPlayerReady({
        roomCode,
        playerId: currentPlayer.id,
        isReady: !currentPlayer.isReady,
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "READY 변경에 실패했습니다.");
    } finally {
      setIsReadyChanging(false);
    }
  };

  return (
    <div className="room-screen">
      <div className="room-panel">
        <div className="room-header">
          <button onClick={onBack}>◀ ROOM</button>
          <button className="leave-button" onClick={handleLeaveRoom} disabled={isLeaving}>
            {isLeaving ? "나가는 중..." : "방 나가기"}
          </button>
        </div>

        <h1 className="room-title">ROOM CREATED</h1>

        <div className="room-code-box">
          <p>ROOM CODE</p>
          <div className="room-code">{room.roomCode}</div>
          <small>친구에게 코드를 알려주세요.</small>
        </div>

        <div className="player-box">
          <h3>PLAYERS</h3>

          <ul>
            {room.players.map((player) => {
              const isMe = player.id === playerId;

              return (
                <li key={player.id} className={player.isReady ? "ready" : "not-ready"}>
                  <span>
                    👤 {player.nickname}
                    {player.role === "host" ? " (HOST)" : ""}
                    {isMe ? " (ME)" : ""}
                  </span>

                  <strong>{player.isReady ? "READY" : "WAIT"}</strong>
                </li>
              );
            })}

            {Array.from({ length: waitingSlots }).map((_, index) => (
              <li key={`waiting-${index}`} className="empty-slot">
                <span>⌛ Waiting...</span>
                <strong>EMPTY</strong>
              </li>
            ))}
          </ul>
        </div>

        {!isHost && (
          <button
            className={currentPlayer?.isReady ? "ready-button ready" : "ready-button"}
            onClick={handleReadyToggle}
            disabled={isReadyChanging}
          >
            {currentPlayer?.isReady ? "READY 완료" : "READY"}
          </button>
        )}

        {isHost ? (
          <>
            <button
              className="start-button"
              onClick={handleStartGame}
              disabled={!canStart || isStarting}
            >
              {isStarting ? "STARTING..." : "▶ START GAME"}
            </button>

            {!hasEnoughPlayers && (
              <p className="room-waiting-message">
                최소 3명이 입장해야 시작할 수 있습니다.
              </p>
            )}

            {hasEnoughPlayers && !allReady && (
              <p className="room-waiting-message">
                모든 플레이어가 READY를 눌러야 시작할 수 있습니다.
              </p>
            )}
          </>
        ) : (
          <p className="room-waiting-message">
            READY 후 방장이 게임을 시작하기를 기다리면 됩니다.
          </p>
        )}

        <p className="room-current-player">
          현재 접속자: {nickname}
        </p>
      </div>
    </div>
  );
}
