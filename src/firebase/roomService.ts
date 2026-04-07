import {
  ref,
  set,
  get,
  push,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database';
import { db } from './config';
import type { Move, TileType, Player, Trap } from '../game';

// ─── Types ───────────────────────────────────────────────

export interface RoomSettings {
  boardSize: number;
  missingCount: number;
  trapLimit: number;
  turnTimeLimit: number;
  missingSeed: number;
}

export type RoomStatus = 'waiting' | 'trapping' | 'playing' | 'finished';

export interface RoomData {
  createdAt: number;
  status: RoomStatus;
  hostId: string;
  guestId: string | null;
  settings: RoomSettings;
  traps?: {
    player1?: TrapEntry[];
    player2?: TrapEntry[];
    player1Confirmed?: boolean;
    player2Confirmed?: boolean;
  };
  moves?: MoveEntry[];
  turnStartedAt?: number;
  winner?: Player | null;
}

export interface TrapEntry {
  row: number;
  col: number;
  blockedTile: TileType;
}

export interface MoveEntry {
  row: number;
  col: number;
  tileType: TileType;
}

// ─── Room code generation ────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─── Room operations ─────────────────────────────────────

export async function createRoom(hostId: string, settings: RoomSettings): Promise<string> {
  // Try up to 5 times to find a unique code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      const roomData: RoomData = {
        createdAt: Date.now(),
        status: 'waiting',
        hostId,
        guestId: null,
        settings,
      };
      await set(roomRef, roomData);

      // Set presence — remove room if host disconnects while waiting.
      const hostPresenceRef = ref(db, `rooms/${code}/presence/host`);
      await set(hostPresenceRef, true);
      onDisconnect(hostPresenceRef).remove();

      return code;
    }
  }
  throw new Error('Failed to generate unique room code');
}

export async function joinRoom(code: string, guestId: string): Promise<RoomData> {
  const roomRef = ref(db, `rooms/${code}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    throw new Error('ルームが見つかりません');
  }

  const data = snapshot.val() as RoomData;
  if (data.guestId) {
    throw new Error('ルームが満員です');
  }

  await update(roomRef, { guestId });

  // Set guest presence.
  const guestPresenceRef = ref(db, `rooms/${code}/presence/guest`);
  await set(guestPresenceRef, true);
  onDisconnect(guestPresenceRef).remove();

  return { ...data, guestId };
}

export async function updateSettings(code: string, settings: RoomSettings): Promise<void> {
  await update(ref(db, `rooms/${code}`), { settings });
}

export async function startGame(code: string, status: RoomStatus): Promise<void> {
  await update(ref(db, `rooms/${code}`), {
    status,
    turnStartedAt: serverTimestamp(),
  });
}

export async function writeMove(code: string, move: Move): Promise<void> {
  const movesRef = ref(db, `rooms/${code}/moves`);
  const snapshot = await get(movesRef);
  const moves: MoveEntry[] = snapshot.val() ?? [];
  moves.push({
    row: move.coord.row,
    col: move.coord.col,
    tileType: move.tileType,
  });
  await set(movesRef, moves);
  // Update turn timer.
  await update(ref(db, `rooms/${code}`), {
    turnStartedAt: serverTimestamp(),
  });
}

export async function writeTraps(
  code: string,
  player: 'player1' | 'player2',
  traps: Trap[],
): Promise<void> {
  const entries: TrapEntry[] = traps.map((t) => ({
    row: t.coord.row,
    col: t.coord.col,
    blockedTile: t.blockedTile,
  }));
  await set(ref(db, `rooms/${code}/traps/${player}`), entries);
}

export async function confirmTraps(
  code: string,
  player: 'player1' | 'player2',
): Promise<void> {
  await set(ref(db, `rooms/${code}/traps/${player}Confirmed`), true);
}

export async function setRoomStatus(code: string, status: RoomStatus, winner?: Player | null): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (winner !== undefined) updates.winner = winner;
  await update(ref(db, `rooms/${code}`), updates);
}

export async function leaveRoom(code: string): Promise<void> {
  await set(ref(db, `rooms/${code}`), null);
}

// ─── Real-time listeners ─────────────────────────────────

export function onRoomChange(code: string, callback: (data: RoomData | null) => void): Unsubscribe {
  const roomRef = ref(db, `rooms/${code}`);
  return onValue(roomRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as RoomData) : null);
  });
}

export function onMovesChange(code: string, callback: (moves: MoveEntry[]) => void): Unsubscribe {
  const movesRef = ref(db, `rooms/${code}/moves`);
  return onValue(movesRef, (snapshot) => {
    callback(snapshot.val() ?? []);
  });
}

// ─── Utilities ───────────────────────────────────────────

/** Generate a random client ID for identifying this browser session. */
export function generateClientId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Convert Firebase TrapEntry[] back to game Trap[]. */
export function trapEntriesToTraps(entries: TrapEntry[], player: Player): Trap[] {
  return entries.map((e) => ({
    coord: { row: e.row, col: e.col },
    blockedTile: e.blockedTile,
    placedBy: player,
  }));
}

/** Convert Firebase MoveEntry to game Move. */
export function moveEntryToMove(entry: MoveEntry): Move {
  return {
    coord: { row: entry.row, col: entry.col },
    tileType: entry.tileType,
  };
}
