import { useState, useEffect, useCallback, useRef } from 'react';
import type { Player } from '../game';
import type { RoomData, RoomSettings } from '../firebase/roomService';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  updateSettings,
  startGame,
  onRoomChange,
  generateClientId,
} from '../firebase/roomService';

export type RoomPhase = 'idle' | 'creating' | 'waiting' | 'joined' | 'error';

interface UseRoomReturn {
  /** Current phase of room lifecycle. */
  phase: RoomPhase;
  /** Room code (set after create/join). */
  roomCode: string | null;
  /** Live room data from Firebase. */
  roomData: RoomData | null;
  /** This client's ID. */
  clientId: string;
  /** Which player this client is (host=player1, guest=player2). */
  localPlayer: Player | null;
  /** Error message if any. */
  error: string | null;
  /** Create a new room with given settings. */
  create: (settings: RoomSettings) => Promise<void>;
  /** Join an existing room by code. */
  join: (code: string) => Promise<void>;
  /** Update room settings (host only). */
  changeSettings: (settings: RoomSettings) => Promise<void>;
  /** Start the game (host only). */
  start: () => Promise<void>;
  /** Leave and destroy the room. */
  leave: () => void;
}

export function useRoom(): UseRoomReturn {
  const [phase, setPhase] = useState<RoomPhase>('idle');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);

  // Stable client ID for this session.
  const clientIdRef = useRef(generateClientId());
  const clientId = clientIdRef.current;

  // Unsubscribe ref for room listener.
  const unsubRef = useRef<(() => void) | null>(null);

  // Clean up listener on unmount.
  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const subscribeToRoom = useCallback((code: string) => {
    unsubRef.current?.();
    unsubRef.current = onRoomChange(code, (data) => {
      if (!data) {
        // Room was deleted.
        setPhase('error');
        setError('ルームが削除されました');
        setRoomData(null);
        return;
      }
      setRoomData(data);
      // Update phase based on room status.
      if (data.guestId) {
        setPhase('joined');
      }
    });
  }, []);

  const create = useCallback(async (settings: RoomSettings) => {
    try {
      setPhase('creating');
      setError(null);
      const code = await createRoom(clientId, settings);
      setRoomCode(code);
      setLocalPlayer('player1');
      setPhase('waiting');
      subscribeToRoom(code);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'ルーム作成に失敗しました');
    }
  }, [clientId, subscribeToRoom]);

  const join = useCallback(async (code: string) => {
    try {
      setError(null);
      const upper = code.toUpperCase().trim();
      const data = await joinRoom(upper, clientId);
      setRoomCode(upper);
      setLocalPlayer('player2');
      setRoomData(data);
      setPhase('joined');
      subscribeToRoom(upper);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'ルーム参加に失敗しました');
    }
  }, [clientId, subscribeToRoom]);

  const changeSettings = useCallback(async (settings: RoomSettings) => {
    if (!roomCode) return;
    await updateSettings(roomCode, settings);
  }, [roomCode]);

  const start = useCallback(async () => {
    if (!roomCode || !roomData) return;
    const { trapLimit } = roomData.settings;
    const status = trapLimit > 0 ? 'trapping' as const : 'playing' as const;
    await startGame(roomCode, status);
  }, [roomCode, roomData]);

  const leave = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (roomCode) {
      leaveRoom(roomCode);
    }
    setPhase('idle');
    setRoomCode(null);
    setRoomData(null);
    setLocalPlayer(null);
    setError(null);
  }, [roomCode]);

  return {
    phase,
    roomCode,
    roomData,
    clientId,
    localPlayer,
    error,
    create,
    join,
    changeSettings,
    start,
    leave,
  };
}
