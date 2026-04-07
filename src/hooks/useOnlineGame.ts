import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, Move, Trap, Player, TileType, CellCoord } from '../game';
import { createInitialState, applyMove, getLegalMoves } from '../game';
import type { RoomData, MoveEntry, TrapEntry } from '../firebase/roomService';
import {
  writeMove,
  writeTraps,
  confirmTraps as fbConfirmTraps,
  setRoomStatus,
  onMovesChange,
  trapEntriesToTraps,
  moveEntryToMove,
} from '../firebase/roomService';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase/config';
import { useServerTime } from './useServerTime';

/** Time limit for trap placement phase (seconds). */
const TRAP_TIME_LIMIT = 60;

interface UseOnlineGameReturn {
  /** Current reconstructed game state. */
  gameState: GameState | null;
  /** Send a move (only valid on your turn). */
  sendMove: (move: Move) => void;
  /** Place a trap during trapping phase. */
  placeTrap: (coord: CellCoord, blockedTile: TileType) => void;
  /** Remove a trap during trapping phase. */
  removeTrap: (coord: CellCoord) => void;
  /** Confirm trap placement. */
  confirmTraps: () => void;
  /** Whether it's the local player's turn. */
  isMyTurn: boolean;
  /** Remaining seconds for the current turn (null if no time limit). */
  timeRemaining: number | null;
  /** Whether the opponent has disconnected. */
  opponentDisconnected: boolean;
  /** Current trapping status. */
  trappingStatus: {
    isTrapping: boolean;
    myTrapsConfirmed: boolean;
    opponentTrapsConfirmed: boolean;
  };
  /** Local player's pending traps (during trapping phase). */
  localTraps: Trap[];
  /** Remaining seconds for trap placement (null if not in trapping phase). */
  trapTimeRemaining: number | null;
}

export function useOnlineGame(
  roomCode: string,
  roomData: RoomData,
  localPlayer: Player,
): UseOnlineGameReturn {
  const { serverNow } = useServerTime();

  // Local traps being placed (not yet confirmed).
  const [localTraps, setLocalTraps] = useState<Trap[]>([]);

  // Track the base state (after traps are resolved) and applied move count.
  const [gameState, setGameState] = useState<GameState | null>(null);
  const appliedMovesRef = useRef(0);
  const baseStateRef = useRef<GameState | null>(null);
  const trapsResolvedRef = useRef(false);

  // Time remaining for current turn.
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  // Time remaining for trap placement.
  const [trapTimeRemaining, setTrapTimeRemaining] = useState<number | null>(null);

  // Opponent presence.
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const { settings } = roomData;
  const opponentPlayer: Player = localPlayer === 'player1' ? 'player2' : 'player1';

  // ── Build initial state from settings ──
  useEffect(() => {
    const initial = createInitialState(
      settings.boardSize,
      settings.missingCount,
      settings.trapLimit,
      settings.missingSeed,
    );
    baseStateRef.current = initial;
    appliedMovesRef.current = 0;
    trapsResolvedRef.current = false;
    setGameState(initial);
    setLocalTraps([]);
  }, [settings.boardSize, settings.missingCount, settings.trapLimit, settings.missingSeed]);

  // ── Listen for trap confirmations and build trap-aware base state ──
  useEffect(() => {
    if (!roomCode) return;

    const trapsRef = ref(db, `rooms/${roomCode}/traps`);
    const unsub = onValue(trapsRef, (snap) => {
      const trapData = snap.val();
      if (!trapData) return;

      const p1Confirmed = trapData.player1Confirmed === true;
      const p2Confirmed = trapData.player2Confirmed === true;

      // Once both confirmed, rebuild state with all traps applied (only once).
      if (p1Confirmed && p2Confirmed && !trapsResolvedRef.current) {
        trapsResolvedRef.current = true;
        const p1Traps: TrapEntry[] = trapData.player1 ?? [];
        const p2Traps: TrapEntry[] = trapData.player2 ?? [];
        const allTraps: Trap[] = [
          ...trapEntriesToTraps(p1Traps, 'player1'),
          ...trapEntriesToTraps(p2Traps, 'player2'),
        ];

        // Reconstruct initial state with traps baked in.
        let state = createInitialState(
          settings.boardSize,
          settings.missingCount,
          settings.trapLimit,
          settings.missingSeed,
        );
        state = { ...state, traps: allTraps, phase: 'opening', currentPlayer: 'player1' };
        // Recompute legal moves with traps.
        state.legalMoves = getLegalMoves(state);

        baseStateRef.current = state;
        appliedMovesRef.current = 0;
        setGameState(state);

        // Transition room status from 'trapping' to 'playing'.
        setRoomStatus(roomCode, 'playing');
      }
    });

    return unsub;
  }, [roomCode, settings]);

  // ── Listen for moves and apply incrementally ──
  useEffect(() => {
    if (!roomCode) return;

    const unsub = onMovesChange(roomCode, (moveEntries: MoveEntry[]) => {
      setGameState((prev) => {
        if (!prev) return prev;
        let state = prev;

        // If we've fallen behind (e.g. reconnect), replay from base.
        if (appliedMovesRef.current > moveEntries.length) {
          state = baseStateRef.current!;
          appliedMovesRef.current = 0;
        }

        // Apply new moves incrementally.
        for (let i = appliedMovesRef.current; i < moveEntries.length; i++) {
          const move = moveEntryToMove(moveEntries[i]);
          state = applyMove(state, move);
        }
        appliedMovesRef.current = moveEntries.length;

        // If game finished, update Firebase status.
        if (state.phase === 'finished' && state.result) {
          setRoomStatus(roomCode, 'finished', state.result.winner);
        }

        return state;
      });
    });

    return unsub;
  }, [roomCode]);

  // ── Turn timer ──
  useEffect(() => {
    if (!roomData.turnStartedAt || !settings.turnTimeLimit || settings.turnTimeLimit === 0) {
      setTimeRemaining(null);
      return;
    }
    if (!gameState || gameState.phase === 'finished' || gameState.phase === 'trapping') {
      setTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (serverNow() - roomData.turnStartedAt!) / 1000;
      const remaining = Math.max(0, settings.turnTimeLimit - elapsed);
      setTimeRemaining(Math.ceil(remaining));

      // Auto-timeout if it's our turn and time ran out.
      if (remaining <= 0 && gameState.currentPlayer === localPlayer) {
        clearInterval(interval);
        // The current player loses on timeout.
        if (gameState.phase !== 'finished') {
          setRoomStatus(roomCode, 'finished', opponentPlayer);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [roomData.turnStartedAt, settings.turnTimeLimit, gameState?.currentPlayer, gameState?.phase, localPlayer, opponentPlayer, roomCode, serverNow]);

  // ── Trap placement timer ──
  const myTrapsConfirmed = roomData.traps?.[`${localPlayer}Confirmed` as keyof typeof roomData.traps] === true;
  const opponentTrapsConfirmed = roomData.traps?.[`${opponentPlayer}Confirmed` as keyof typeof roomData.traps] === true;
  const isTrapping = roomData.status === 'trapping';

  useEffect(() => {
    if (!isTrapping || !roomData.turnStartedAt) {
      setTrapTimeRemaining(null);
      return;
    }
    // Already confirmed — no timer needed for this player.
    if (myTrapsConfirmed) {
      setTrapTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (serverNow() - roomData.turnStartedAt!) / 1000;
      const remaining = Math.max(0, TRAP_TIME_LIMIT - elapsed);
      setTrapTimeRemaining(Math.ceil(remaining));

      if (remaining <= 0) {
        clearInterval(interval);
        // Player who didn't confirm in time loses.
        setRoomStatus(roomCode, 'finished', opponentPlayer);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isTrapping, roomData.turnStartedAt, myTrapsConfirmed, serverNow, roomCode, opponentPlayer]);

  // ── Opponent presence ──
  useEffect(() => {
    if (!roomCode) return;
    const presenceKey = localPlayer === 'player1' ? 'guest' : 'host';
    const presenceRef = ref(db, `rooms/${roomCode}/presence/${presenceKey}`);
    const unsub = onValue(presenceRef, (snap) => {
      setOpponentDisconnected(!snap.exists());
    });
    return unsub;
  }, [roomCode, localPlayer]);

  // ── Actions ──

  const sendMove = useCallback((move: Move) => {
    if (!gameState || gameState.currentPlayer !== localPlayer) return;
    if (gameState.phase === 'finished') return;
    // Optimistically apply locally.
    const newState = applyMove(gameState, move);
    if (newState !== gameState) {
      appliedMovesRef.current++;
      setGameState(newState);
      writeMove(roomCode, move);
      if (newState.phase === 'finished' && newState.result) {
        setRoomStatus(roomCode, 'finished', newState.result.winner);
      }
    }
  }, [gameState, localPlayer, roomCode]);

  const placeTrap = useCallback((coord: CellCoord, blockedTile: TileType) => {
    setLocalTraps((prev) => {
      // Check limit.
      if (prev.length >= settings.trapLimit) return prev;
      // One trap per cell per player.
      if (prev.some((t) => t.coord.row === coord.row && t.coord.col === coord.col)) return prev;
      return [...prev, { coord, blockedTile, placedBy: localPlayer }];
    });
  }, [localPlayer, settings.trapLimit]);

  const removeTrap = useCallback((coord: CellCoord) => {
    setLocalTraps((prev) =>
      prev.filter((t) => !(t.coord.row === coord.row && t.coord.col === coord.col)),
    );
  }, []);

  const confirmTrapsFn = useCallback(() => {
    // Write traps to Firebase and confirm.
    writeTraps(roomCode, localPlayer, localTraps);
    fbConfirmTraps(roomCode, localPlayer);
  }, [roomCode, localPlayer, localTraps]);

  const isMyTurn = gameState?.currentPlayer === localPlayer && gameState?.phase !== 'finished';

  return {
    gameState,
    sendMove,
    placeTrap,
    removeTrap,
    confirmTraps: confirmTrapsFn,
    isMyTurn: isMyTurn ?? false,
    timeRemaining,
    opponentDisconnected,
    trappingStatus: {
      isTrapping,
      myTrapsConfirmed: myTrapsConfirmed as boolean,
      opponentTrapsConfirmed: opponentTrapsConfirmed as boolean,
    },
    localTraps,
    trapTimeRemaining,
  };
}
