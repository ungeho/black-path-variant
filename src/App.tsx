import { useCallback, useReducer, useState, useEffect, useMemo, useRef } from 'react';
import type { GameState, Move, AIDifficulty, Player } from './game';
import { createInitialState, applyMove, selectAIMove } from './game';
import { GameBoard } from './components/GameBoard';
import { HUD } from './components/HUD';
import { ControlPanel } from './components/ControlPanel';
import { HelpModal } from './components/HelpModal';
import { useRecord } from './hooks/useRecord';
import './App.css';

export type GameMode = 'pvp' | 'pve';
export type PlayerSide = 'first' | 'second';

/** Delay (ms) between each auto-follow step in the animation. */
const AUTO_FOLLOW_STEP_MS = 300;
/** Delay (ms) before AI makes its move. */
const AI_MOVE_DELAY_MS = 500;
/** Turn time limit in seconds. 0 = no limit. */
const TURN_TIME_OPTIONS = [0, 10, 20, 30, 60] as const;
export type TurnTimeLimit = (typeof TURN_TIME_OPTIONS)[number];
export { TURN_TIME_OPTIONS };

interface AppState {
  current: GameState;
  history: GameState[];
}

type Action =
  | { type: 'move'; move: Move }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'timeout' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'move': {
      const next = applyMove(state.current, action.move);
      if (next === state.current) return state;
      return {
        current: next,
        history: [...state.history, state.current],
      };
    }
    case 'undo': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        current: prev,
        history: state.history.slice(0, -1),
      };
    }
    case 'timeout': {
      if (state.current.phase === 'finished') return state;
      // Current player loses by timeout.
      const loser = state.current.currentPlayer;
      const winner: Player = loser === 'player1' ? 'player2' : 'player1';
      return {
        ...state,
        current: {
          ...state.current,
          phase: 'finished',
          result: { winner, reason: 'timeout' as any },
          legalMoves: [],
        },
      };
    }
    case 'restart':
      return createAppState();
  }
}

function createAppState(): AppState {
  return { current: createInitialState(), history: [] };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, createAppState);
  const [mode, setMode] = useState<GameMode>('pvp');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [playerSide, setPlayerSide] = useState<PlayerSide>('first');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(0);
  const [showHelp, setShowHelp] = useState(false);
  const gameState = state.current;
  const { getRecord, addResult } = useRecord();

  // Determine which player is AI.
  const aiPlayer: Player | null = mode === 'pve'
    ? (playerSide === 'first' ? 'player2' : 'player1')
    : null;

  // ── Record results ──
  const recordKey = mode === 'pve' ? `pve-${aiDifficulty}` : 'pvp';
  const record = getRecord(recordKey);

  const prevPhaseRef = useRef(gameState.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'finished' && gameState.phase === 'finished' && gameState.result) {
      if (mode === 'pve' && aiPlayer) {
        const humanWon = gameState.result.winner !== aiPlayer;
        addResult(recordKey, humanWon ? 'win' : 'loss');
      } else {
        // PvP: record from player1 perspective
        addResult(recordKey, gameState.result.winner === 'player1' ? 'win' : 'loss');
      }
    }
    prevPhaseRef.current = gameState.phase;
  }, [gameState.phase, gameState.result, mode, aiPlayer, recordKey, addResult]);

  // ── Auto-follow animation ──
  const { autoFollowCount, pathCoords } = gameState;
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [animatingMoveCount, setAnimatingMoveCount] = useState(0);

  const moveCount = gameState.moveHistory.length;
  useEffect(() => {
    if (moveCount !== animatingMoveCount) {
      setAnimatingMoveCount(moveCount);
      setRevealedSteps(0);
    }
  }, [moveCount, animatingMoveCount]);

  useEffect(() => {
    if (autoFollowCount === 0 || revealedSteps >= autoFollowCount) return;
    const timer = setTimeout(() => {
      setRevealedSteps((s) => s + 1);
    }, AUTO_FOLLOW_STEP_MS);
    return () => clearTimeout(timer);
  }, [revealedSteps, autoFollowCount]);

  const isAnimating = autoFollowCount > 0 && revealedSteps < autoFollowCount;

  // ── AI move ──
  const isAITurn =
    aiPlayer !== null &&
    gameState.currentPlayer === aiPlayer &&
    gameState.phase !== 'finished' &&
    !isAnimating;

  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    if (!isAITurn) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    const timer = setTimeout(() => {
      const move = selectAIMove(gameState, aiDifficulty);
      setAiThinking(false);
      if (move) dispatch({ type: 'move', move });
    }, AI_MOVE_DELAY_MS);
    return () => { clearTimeout(timer); setAiThinking(false); };
  }, [isAITurn, gameState, aiDifficulty, aiPlayer]);

  // ── Turn timer ──
  const [turnElapsed, setTurnElapsed] = useState(0);
  const turnStartRef = useRef(Date.now());

  // Reset timer when move count changes or game restarts.
  useEffect(() => {
    turnStartRef.current = Date.now();
    setTurnElapsed(0);
  }, [moveCount, gameState.phase]);

  useEffect(() => {
    if (turnTimeLimit === 0 || gameState.phase !== 'playing' || isAnimating) return;
    // Don't tick timer for AI — AI has its own time budget.
    if (isAITurn) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - turnStartRef.current) / 1000);
      setTurnElapsed(elapsed);
      if (elapsed >= turnTimeLimit) {
        dispatch({ type: 'timeout' });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [turnTimeLimit, gameState.phase, isAnimating, isAITurn, moveCount]);

  const turnRemaining = turnTimeLimit > 0 ? Math.max(0, turnTimeLimit - turnElapsed) : null;

  // ── Display state (with animation truncation) ──
  const displayState = useMemo((): GameState => {
    if (!isAnimating) return gameState;
    const hiddenCount = autoFollowCount - revealedSteps;
    const visibleCoords = pathCoords.slice(0, pathCoords.length - hiddenCount);
    return {
      ...gameState,
      pathCoords: visibleCoords,
      pathHead: visibleCoords[visibleCoords.length - 1],
      legalMoves: [],
    };
  }, [gameState, isAnimating, autoFollowCount, revealedSteps, pathCoords]);

  // Disable human interaction during AI turn or animation.
  const interactiveState = useMemo((): GameState => {
    if (isAITurn) return { ...displayState, legalMoves: [] };
    return displayState;
  }, [displayState, isAITurn]);

  const handleMove = useCallback(
    (move: Move) => dispatch({ type: 'move', move }),
    [],
  );
  const handleRestart = useCallback(() => dispatch({ type: 'restart' }), []);
  const handleUndo = useCallback(() => {
    // In PvE, undo two moves (player + AI) if possible.
    if (mode === 'pve' && state.history.length >= 2) {
      dispatch({ type: 'undo' });
      dispatch({ type: 'undo' });
    } else {
      dispatch({ type: 'undo' });
    }
  }, [mode, state.history.length]);
  const handleModeChange = useCallback((newMode: GameMode) => {
    setMode(newMode);
    dispatch({ type: 'restart' });
  }, []);
  const handleSideChange = useCallback((side: PlayerSide) => {
    setPlayerSide(side);
    dispatch({ type: 'restart' });
  }, []);
  const handleTimeLimitChange = useCallback((limit: TurnTimeLimit) => {
    setTurnTimeLimit(limit);
    dispatch({ type: 'restart' });
  }, []);

  return (
    <div className="app">
      <h1 className="title">Black Path Game</h1>
      <HUD
        state={displayState}
        aiThinking={aiThinking}
        turnRemaining={turnRemaining}
        aiPlayer={aiPlayer}
        record={record}
      />
      <GameBoard state={interactiveState} onMove={handleMove} onUndo={handleUndo} />
      <ControlPanel
        mode={mode}
        onModeChange={handleModeChange}
        aiDifficulty={aiDifficulty}
        onDifficultyChange={setAIDifficulty}
        playerSide={playerSide}
        onSideChange={handleSideChange}
        turnTimeLimit={turnTimeLimit}
        onTimeLimitChange={handleTimeLimitChange}
        onRestart={handleRestart}
        canUndo={state.history.length > 0 && !isAnimating && !isAITurn}
        onUndo={handleUndo}
        onHelp={() => setShowHelp(true)}
      />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
