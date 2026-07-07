import type { RoomPlayer } from "../../services/roomService";

const FIRST_TILE_ID = "cloud-3";

export function findFirstPlayerId(players: RoomPlayer[]): string {
  const firstPlayer = players.find((player) =>
    player.tiles?.some((tile) => tile.id === FIRST_TILE_ID)
  );

  if (!firstPlayer) {
    throw new Error("구름 3을 가진 플레이어를 찾을 수 없습니다.");
  }

  return firstPlayer.id;
}

export function getNextPlayerId(players: RoomPlayer[], currentPlayerId: string) {
  const currentIndex = players.findIndex((player) => player.id === currentPlayerId);

  if (currentIndex === -1) {
    throw new Error("현재 턴 플레이어를 찾을 수 없습니다.");
  }

  const nextIndex = (currentIndex + 1) % players.length;

  return players[nextIndex].id;
}