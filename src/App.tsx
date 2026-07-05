import { useState } from "react";

import "./App.css";

import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";

type Screen = "home" | "room";

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

  const handleCreateRoom = (name: string) => {
    setNickname(name);
    setRoomCode(createRoomCode());
    setScreen("room");
  };

  return screen === "room" ? (
    <RoomPage
      nickname={nickname}
      roomCode={roomCode}
      onBack={() => setScreen("home")}
    />
  ) : (
    <HomePage onCreateRoom={handleCreateRoom} />
  );
}

export default App;