import { useState } from "react";
import "./HomePage.css";

type HomePageProps = {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
};

export default function HomePage({ onCreateRoom, onJoinRoom }: HomePageProps) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    const name = nickname.trim();

    if (!name) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    onCreateRoom(name);
  };

  const handleJoinRoom = () => {
    const name = nickname.trim();
    const code = roomCode.trim().toUpperCase();

    if (!name) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    if (!code) {
      alert("방 코드를 입력해주세요.");
      return;
    }

    onJoinRoom(name, code);
  };

  return (
    <div className="home-screen">
      <div className="home-panel">
        <div className="home-stars" />

        <div className="home-hud">
          <span>♥ ♥ ♥</span>
          <span>1P 00000 ◈</span>
        </div>

        <h1 className="home-title">TILE ROOM</h1>

        <p className="home-start-text">▶ PRESS START TO PLAY ◀</p>

        <div className="home-divider">·······························</div>

        <label className="home-input-label">NICKNAME</label>
        <input
          className="home-nickname-input"
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />

        <label className="home-input-label">ROOM CODE</label>
        <input
          className="home-nickname-input"
          placeholder="참가할 방 코드를 입력하세요"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
        />

        <div className="home-button-stack">
          <button
            className="home-pixel-button home-create-button"
            onClick={handleCreateRoom}
          >
            <span className="home-button-icon">🏆</span>
            <span>
              게임 만들기
              <small>CREATE ROOM</small>
            </span>
          </button>

          <button
            className="home-pixel-button home-join-button"
            onClick={handleJoinRoom}
          >
            <span className="home-button-icon">👥</span>
            <span>
              게임 참가
              <small>JOIN ROOM</small>
            </span>
          </button>
        </div>

        <footer className="home-footer-text">© 2026 TILE ROOM</footer>
      </div>
    </div>
  );
}