import "./RoomPage.css";

type RoomPageProps = {
  nickname: string;
  roomCode: string;
  onBack: () => void;
};

export default function RoomPage({ nickname, roomCode, onBack }: RoomPageProps) {
  return (
    <div className="room-screen">
      <div className="room-panel">
        <div className="room-header">
          <button onClick={onBack}>◀ ROOM</button>
          <span>ONLINE</span>
        </div>

        <h1 className="room-title">ROOM CREATED</h1>

        <div className="room-code-box">
          <p>ROOM CODE</p>

          <div className="room-code">{roomCode}</div>

          <small>친구에게 코드를 알려주세요.</small>
        </div>

        <div className="player-box">
          <h3>PLAYERS</h3>

          <ul>
            <li>👤 {nickname} (HOST)</li>
            <li>⌛ Waiting...</li>
            <li>⌛ Waiting...</li>
            <li>⌛ Waiting...</li>
          </ul>
        </div>

        <button className="pixel-button start-button">▶ START GAME</button>
      </div>
    </div>
  );
}