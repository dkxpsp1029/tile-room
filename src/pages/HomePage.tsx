import { useState } from "react";
import "./HomePage.css";

type HomePageProps = {
  onCreateRoom: (nickname: string) => void;
};

export default function HomePage({ onCreateRoom }: HomePageProps) {
  const [nickname, setNickname] = useState("");

  const handleCreateRoom = () => {
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    onCreateRoom(trimmedNickname);
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
            onClick={() => alert("게임 참가 기능은 다음 단계에서 만들 예정입니다.")}
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