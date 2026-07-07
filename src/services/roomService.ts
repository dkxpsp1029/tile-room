import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { dealTiles } from "../game/dealer/dealer";
import { validatePlay } from "../game/rules/validator";
import { findFirstPlayerId, getNextPlayerId } from "../game/turn/turnManager";
import {
  calculateScoreResult,
  INITIAL_CHIP_SCORE,
  type ChipInventory,
  type ScoreResult,
} from "../game/score/scoreManager";
import type { ComboResult } from "../game/combo/combo";
import type { LexioTile } from "../types/lexio";

export type RoomPlayer = {
  id: string;
  nickname: string;
  role: "host" | "player";
  isReady: boolean;
  joinedAt: number;
  tiles?: LexioTile[];
  chipScore: number;
  chipInventory?: ChipInventory;
};

export type RoomData = {
  roomCode: string;
  status: "waiting" | "playing" | "finished";
  hostNickname: string;
  players: RoomPlayer[];
  maxPlayers: number;
  game?: {
    round: number;
    currentTurnPlayerId: string;
    currentCombo: ComboResult | null;
    tableTiles: LexioTile[];
    passPlayerIds: string[];
    lastPlayedPlayerId: string | null;
    winnerPlayerId: string | null;
    replayReadyPlayerIds?: string[];
    replayCountdownStartedAt?: number | null;
    finishedAt?: number | null;
    scoreResult?: ScoreResult | null;
  };
};

type CreateRoomParams = {
  roomCode: string;
  nickname: string;
};

type JoinRoomParams = {
  roomCode: string;
  nickname: string;
};

type RoomEntryResult = {
  roomCode: string;
  playerId: string;
};

function createNextGameData(room: RoomData) {
  const playerIds = room.players.map((player) => player.id);
  const dealtTiles = dealTiles(playerIds);

  const playersWithTiles: RoomPlayer[] = room.players.map((player) => ({
    ...player,
    isReady: true,
    tiles: dealtTiles[player.id] ?? [],
  }));

  const firstPlayerId = findFirstPlayerId(playersWithTiles);

  return {
    status: "playing" as const,
    startedAt: serverTimestamp(),
    players: playersWithTiles,
    game: {
      round: (room.game?.round ?? 0) + 1,
      currentTurnPlayerId: firstPlayerId,
      currentCombo: null,
      tableTiles: [],
      passPlayerIds: [],
      lastPlayedPlayerId: null,
      winnerPlayerId: null,
      replayReadyPlayerIds: [],
      replayCountdownStartedAt: null,
      finishedAt: null,
      scoreResult: null,
    },
  };
}

export async function createRoom({
  roomCode,
  nickname,
}: CreateRoomParams): Promise<RoomEntryResult> {
  const roomRef = doc(db, "rooms", roomCode);
  const playerId = crypto.randomUUID();

  await setDoc(roomRef, {
    roomCode,
    status: "waiting",
    hostNickname: nickname,
    players: [
      {
        id: playerId,
        nickname,
        role: "host",
        isReady: true,
        joinedAt: Date.now(),
        tiles: [],
        chipScore: INITIAL_CHIP_SCORE,
      },
    ],
    maxPlayers: 5,
    createdAt: serverTimestamp(),
  });

  return {
    roomCode,
    playerId,
  };
}

export async function joinRoom({
  roomCode,
  nickname,
}: JoinRoomParams): Promise<RoomEntryResult> {
  const normalizedRoomCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", normalizedRoomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;

  if (room.status !== "waiting") {
    throw new Error("GAME_ALREADY_STARTED");
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error("ROOM_FULL");
  }

  const playerId = crypto.randomUUID();

  const nextPlayers: RoomPlayer[] = [
    ...room.players,
    {
      id: playerId,
      nickname,
      role: "player",
      isReady: false,
      joinedAt: Date.now(),
      tiles: [],
      chipScore: INITIAL_CHIP_SCORE,
    },
  ];

  await updateDoc(roomRef, {
    players: nextPlayers,
  });

  return {
    roomCode: normalizedRoomCode,
    playerId,
  };
}

export async function setPlayerReady({
  roomCode,
  playerId,
  isReady,
}: {
  roomCode: string;
  playerId: string;
  isReady: boolean;
}) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;

  if (room.status !== "waiting") {
    throw new Error("대기방에서만 READY를 바꿀 수 있습니다.");
  }

  const targetPlayer = room.players.find((player) => player.id === playerId);

  if (!targetPlayer) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  if (targetPlayer.role === "host") {
    throw new Error("방장은 항상 READY 상태입니다.");
  }

  const nextPlayers = room.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }

    return {
      ...player,
      isReady,
    };
  });

  await updateDoc(roomRef, {
    players: nextPlayers,
  });
}

export async function startGame(roomCode: string) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;
  const playerCount = room.players.length;

  if (playerCount < 3) {
    throw new Error("렉시오는 최소 3명이 필요합니다.");
  }

  if (playerCount > 5) {
    throw new Error("렉시오는 최대 5명까지 가능합니다.");
  }

  const allReady = room.players.every((player) => player.isReady);

  if (!allReady) {
    throw new Error("모든 플레이어가 READY 상태여야 시작할 수 있습니다.");
  }

  await updateDoc(roomRef, createNextGameData(room));
}

function finishGame({
  room,
  nextPlayers,
  winnerPlayerId,
}: {
  room: RoomData;
  nextPlayers: RoomPlayer[];
  winnerPlayerId: string;
}) {
  const scoreResult = calculateScoreResult(nextPlayers);

  const playersWithScores = nextPlayers.map((player) => {
    const ranking = scoreResult.rankings.find(
      (item) => item.playerId === player.id
    );

    return {
      ...player,
      chipScore: ranking?.chipScoreAfter ?? player.chipScore,
    };
  });

  return {
    status: "finished" as const,
    players: playersWithScores,
    game: {
      ...room.game!,
      currentTurnPlayerId: winnerPlayerId,
      passPlayerIds: [],
      winnerPlayerId,
      replayReadyPlayerIds: [],
      replayCountdownStartedAt: null,
      finishedAt: Date.now(),
      scoreResult,
    },
  };
}

export async function playTiles({
  roomCode,
  playerId,
  selectedTileIds,
}: {
  roomCode: string;
  playerId: string;
  selectedTileIds: string[];
}) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;

  if (!room.game) {
    throw new Error("GAME_NOT_STARTED");
  }

  if (room.status !== "playing") {
    throw new Error("진행 중인 게임이 아닙니다.");
  }

  if (room.game.currentTurnPlayerId !== playerId) {
    throw new Error("아직 내 차례가 아닙니다.");
  }

  const player = room.players.find((item) => item.id === playerId);

  if (!player) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  const playerTiles = player.tiles ?? [];
  const selectedTiles = playerTiles.filter((tile) =>
    selectedTileIds.includes(tile.id)
  );

  if (selectedTiles.length !== selectedTileIds.length) {
    throw new Error("선택한 타일을 찾을 수 없습니다.");
  }

  const validation = validatePlay({
    selectedTiles,
    currentCombo: room.game.currentCombo,
  });

  if (validation.ok === false) {
    throw new Error(validation.reason);
  }

  const nextPlayers = room.players.map((item) => {
    if (item.id !== playerId) {
      return item;
    }

    return {
      ...item,
      tiles: (item.tiles ?? []).filter(
        (tile) => !selectedTileIds.includes(tile.id)
      ),
    };
  });

  const updatedPlayer = nextPlayers.find((item) => item.id === playerId);
  const isWinner = (updatedPlayer?.tiles ?? []).length === 0;

  if (isWinner) {
    await updateDoc(
      roomRef,
      finishGame({
        room,
        nextPlayers,
        winnerPlayerId: playerId,
      })
    );

    return;
  }

  await updateDoc(roomRef, {
    status: "playing",
    players: nextPlayers,
    game: {
      ...room.game,
      currentTurnPlayerId: getNextPlayerId(nextPlayers, playerId),
      currentCombo: validation.combo,
      tableTiles: selectedTiles,
      passPlayerIds: [],
      lastPlayedPlayerId: playerId,
      winnerPlayerId: null,
      replayReadyPlayerIds: room.game.replayReadyPlayerIds ?? [],
      replayCountdownStartedAt: room.game.replayCountdownStartedAt ?? null,
      finishedAt: room.game.finishedAt ?? null,
      scoreResult: room.game.scoreResult ?? null,
    },
  });
}

export async function passTurn({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;

  if (!room.game) {
    throw new Error("GAME_NOT_STARTED");
  }

  if (room.status !== "playing") {
    throw new Error("진행 중인 게임이 아닙니다.");
  }

  if (room.game.currentTurnPlayerId !== playerId) {
    throw new Error("아직 내 차례가 아닙니다.");
  }

  if (!room.game.currentCombo || !room.game.lastPlayedPlayerId) {
    throw new Error("선은 패스할 수 없습니다.");
  }

  const nextPassPlayerIds = [...new Set([...room.game.passPlayerIds, playerId])];

  const everyoneExceptLastPlayedPassed =
    nextPassPlayerIds.length >= room.players.length - 1;

  if (everyoneExceptLastPlayedPassed) {
    await updateDoc(roomRef, {
      game: {
        ...room.game,
        currentTurnPlayerId: room.game.lastPlayedPlayerId,
        currentCombo: null,
        tableTiles: [],
        passPlayerIds: [],
      },
    });

    return;
  }

  await updateDoc(roomRef, {
    game: {
      ...room.game,
      currentTurnPlayerId: getNextPlayerId(room.players, playerId),
      passPlayerIds: nextPassPlayerIds,
    },
  });
}

export async function setReplayReady({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const roomRef = doc(db, "rooms", roomCode);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("ROOM_NOT_FOUND");
    }

    const room = roomSnap.data() as RoomData;

    if (!room.game || room.status !== "finished") {
      throw new Error("게임 종료 후에만 다시하기를 준비할 수 있습니다.");
    }

    const playerExists = room.players.some((player) => player.id === playerId);

    if (!playerExists) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    const nextReadyIds = [...new Set([...(room.game.replayReadyPlayerIds ?? []), playerId])];
    const allReady = room.players.every((player) => nextReadyIds.includes(player.id));

    transaction.update(roomRef, {
      game: {
        ...room.game,
        replayReadyPlayerIds: nextReadyIds,
        replayCountdownStartedAt:
          allReady && !room.game.replayCountdownStartedAt
            ? Date.now()
            : room.game.replayCountdownStartedAt ?? null,
      },
    });
  });
}

export async function startReplayIfReady({ roomCode }: { roomCode: string }) {
  const roomRef = doc(db, "rooms", roomCode);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("ROOM_NOT_FOUND");
    }

    const room = roomSnap.data() as RoomData;

    if (!room.game || room.status !== "finished") {
      return;
    }

    const readyIds = room.game.replayReadyPlayerIds ?? [];
    const allReady = room.players.length > 0 && room.players.every((player) => readyIds.includes(player.id));

    if (!allReady) {
      return;
    }

    if (room.players.length < 3) {
      throw new Error("다시 시작하려면 최소 3명이 필요합니다.");
    }

    const countdownStartedAt = room.game.replayCountdownStartedAt;

    if (!countdownStartedAt || Date.now() - countdownStartedAt < 2800) {
      return;
    }

    transaction.update(roomRef, createNextGameData(room));
  });
}

export async function restartGame({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const room = roomSnap.data() as RoomData;
  const requester = room.players.find((player) => player.id === playerId);

  if (!requester) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  if (requester.role !== "host") {
    throw new Error("방장만 다시 시작할 수 있습니다.");
  }

  const playerCount = room.players.length;

  if (playerCount < 3) {
    throw new Error("렉시오는 최소 3명이 필요합니다.");
  }

  if (playerCount > 5) {
    throw new Error("렉시오는 최대 5명까지 가능합니다.");
  }

  await updateDoc(roomRef, createNextGameData(room));
}

export async function leaveRoom({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    return;
  }

  const room = roomSnap.data() as RoomData;
  const leavingPlayer = room.players.find((player) => player.id === playerId);

  if (!leavingPlayer) {
    return;
  }

  const remainingPlayers = room.players.filter((player) => player.id !== playerId);

  if (remainingPlayers.length === 0) {
    await deleteDoc(roomRef);
    return;
  }

  const nextPlayers: RoomPlayer[] = remainingPlayers.map((player, index) => {
    if (leavingPlayer.role === "host" && index === 0) {
      return {
        ...player,
        role: "host",
        isReady: true,
      };
    }

    return player;
  });

  const nextHost = nextPlayers.find((player) => player.role === "host") ?? nextPlayers[0];

  if (room.status === "waiting") {
    await updateDoc(roomRef, {
      hostNickname: nextHost.nickname,
      players: nextPlayers,
    });

    return;
  }

  if (!room.game) {
    await updateDoc(roomRef, {
      hostNickname: nextHost.nickname,
      players: nextPlayers,
    });

    return;
  }

  if (nextPlayers.length === 1) {
    const finishData = finishGame({
      room,
      nextPlayers,
      winnerPlayerId: nextPlayers[0].id,
    });

    await updateDoc(roomRef, {
      ...finishData,
      hostNickname: nextHost.nickname,
    });

    return;
  }

  const removedPlayerIds = new Set([playerId]);
  const nextPassPlayerIds = room.game.passPlayerIds.filter(
    (id) => !removedPlayerIds.has(id)
  );
  const lastPlayedStillExists = nextPlayers.some(
    (player) => player.id === room.game?.lastPlayedPlayerId
  );

  let currentTurnPlayerId = room.game.currentTurnPlayerId;

  if (room.game.currentTurnPlayerId === playerId) {
    const leavingIndex = room.players.findIndex((player) => player.id === playerId);
    const nextOriginalPlayers = [
      ...room.players.slice(leavingIndex + 1),
      ...room.players.slice(0, leavingIndex),
    ];
    const nextTurnPlayer = nextOriginalPlayers.find((player) =>
      nextPlayers.some((remainingPlayer) => remainingPlayer.id === player.id)
    );

    currentTurnPlayerId = nextTurnPlayer?.id ?? nextPlayers[0].id;
  }

  const nextReplayReadyIds = (room.game.replayReadyPlayerIds ?? []).filter(
    (id) => !removedPlayerIds.has(id)
  );

  await updateDoc(roomRef, {
    hostNickname: nextHost.nickname,
    players: nextPlayers,
    game: {
      ...room.game,
      currentTurnPlayerId,
      lastPlayedPlayerId: lastPlayedStillExists
        ? room.game.lastPlayedPlayerId
        : null,
      currentCombo: lastPlayedStillExists ? room.game.currentCombo : null,
      tableTiles: lastPlayedStillExists ? room.game.tableTiles : [],
      passPlayerIds: nextPassPlayerIds,
      replayReadyPlayerIds: nextReplayReadyIds,
      replayCountdownStartedAt: null,
    },
  });
}

export function subscribeRoom(
  roomCode: string,
  onRoomChange: (room: RoomData | null) => void
): Unsubscribe {
  const roomRef = doc(db, "rooms", roomCode);

  return onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      onRoomChange(null);
      return;
    }

    onRoomChange(snapshot.data() as RoomData);
  });
}
