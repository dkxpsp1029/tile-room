import { useState } from "react";

import "./App.css";

import GamePage from "./pages/GamePage";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";

import { createRoom, joinRoom } from "./services/roomService";

type Screen = "home" | "room" | "game";

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetToHome = () => {
    setScreen("home");
    setNickname("");
    setRoomCode("");
    setPlayerId("");
  };

  const handleCreateRoom = async (name: string) => {
    if (isLoading) return;

    const newRoomCode = createRoomCode();

    try {
      setIsLoading(true);

      const result = await createRoom({
        roomCode: newRoomCode,
        nickname: name,
      });

      setNickname(name);
      setRoomCode(result.roomCode);
      setPlayerId(result.playerId);
      setScreen("room");
    } catch (error) {
      console.error(error);
      alert("방 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (name: string, code: string) => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      const result = await joinRoom({
        nickname: name,
        roomCode: code,
      });

      setNickname(name);
      setRoomCode(result.roomCode);
      setPlayerId(result.playerId);
      setScreen("room");
    } catch (error) {
      console.error(error);
      alert("방 참가에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (screen === "game") {
    return (
      <GamePage
        nickname={nickname}
        roomCode={roomCode}
        playerId={playerId}
        onLeaveComplete={resetToHome}
      />
    );
  }

  if (screen === "room") {
    return (
      <RoomPage
        nickname={nickname}
        roomCode={roomCode}
        playerId={playerId}
        onBack={resetToHome}
        onGameStart={() => setScreen("game")}
        onLeaveComplete={resetToHome}
      />
    );
  }

  return (
    <HomePage
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
    />
  );
}

export default App;
