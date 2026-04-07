import { useCallback, useReducer, useState, useEffect, useMemo, useRef } from 'react';
import type { GameState, Move, AIDifficulty, Player, CellCoord, TileType } from './game';
import { createInitialState, applyMove, placeTrap, removeTrap, confirmTraps, selectAIMove } from './game';
import { GameBoard } from './components/GameBoard';
import { HUD } from './components/HUD';
import { ControlPanel } from './components/ControlPanel';
import { HelpModal } from './components/HelpModal';
import { Lobby, WaitingScreen } from './components/Lobby';
import { RoomLobby } from './components/RoomLobby';
import { OnlineGame } from './components/OnlineGame';
import { useRoom } from './hooks/useRoom';
import { useRecord } from './hooks/useRecord';
import { useSound } from './hooks/useSound';
import './App.css';

export type GameMode = 'pvp' | 'pve' | 'online';
export type PlayerSide = 'first' | 'second';

/** Delay (ms) between each auto-follow step in the animation. */
const AUTO_FOLLOW_STEP_MS = 300;
/** Delay (ms) before AI makes its move. */
const AI_MOVE_DELAY_MS = 500;
/** Turn time limit in seconds. 0 = no limit. */
const TURN_TIME_OPTIONS = [0, 3, 5, 7, 9] as const;
export type TurnTimeLimit = (typeof TURN_TIME_OPTIONS)[number];
export { TURN_TIME_OPTIONS };

const BOARD_SIZE_OPTIONS = [6, 8, 10] as const;
export type BoardSizeOption = (typeof BOARD_SIZE_OPTIONS)[number];
export { BOARD_SIZE_OPTIONS };

interface AppState {
  current: GameState;
  history: GameState[];
}

type Action =
  | { type: 'move'; move: Move }
  | { type: 'undo' }
  | { type: 'restart'; boardSize?: number; missingCount?: number; trapLimit?: number }
  | { type: 'timeout' }
  | { type: 'placeTrap'; coord: CellCoord; blockedTile: TileType }
  | { type: 'removeTrap'; coord: CellCoord }
  | { type: 'confirmTraps' };

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
      return createAppState(action.boardSize, action.missingCount, action.trapLimit);
    case 'placeTrap': {
      const next = placeTrap(state.current, action.coord, action.blockedTile);
      if (next === state.current) return state;
      return { ...state, current: next };
    }
    case 'removeTrap': {
      const next = removeTrap(state.current, action.coord);
      if (next === state.current) return state;
      return { ...state, current: next };
    }
    case 'confirmTraps': {
      const next = confirmTraps(state.current);
      if (next === state.current) return state;
      return { ...state, current: next };
    }
  }
}

function createAppState(boardSize?: number | null, missingCount?: number, trapLimit?: number): AppState {
  return { current: createInitialState(boardSize ?? undefined, missingCount ?? 0, trapLimit ?? 0), history: [] };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, createAppState);
  const room = useRoom();

  // Check URL for ?room=XXXX parameter on mount.
  const urlRoomCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  }, []);

  const [mode, setMode] = useState<GameMode>(urlRoomCode ? 'online' : 'pvp');
  const [urlJoinAttempted, setUrlJoinAttempted] = useState(false);

  // Auto-join room from URL parameter.
  useEffect(() => {
    if (urlRoomCode && !urlJoinAttempted && room.phase === 'idle') {
      setUrlJoinAttempted(true);
      // Clear the URL parameter without reload.
      window.history.replaceState({}, '', window.location.pathname);
      room.join(urlRoomCode);
    }
  }, [urlRoomCode, urlJoinAttempted, room]);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [playerSide, setPlayerSide] = useState<PlayerSide>('first');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(0);
  const [boardSizeOption, setBoardSizeOption] = useState<BoardSizeOption>(8);
  const [missingCountOption, setMissingCountOption] = useState(0);
  const [trapLimitOption, setTrapLimitOption] = useState(0);
  const [showHandoff, setShowHandoff] = useState<Player | 'pre1' | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [replayMoves, setReplayMoves] = useState<Move[] | null>(null);
  const [replayStep, setReplayStep] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const gameState = state.current;
  const { getRecord, addResult } = useRecord();
  const sound = useSound();

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
        if (humanWon) sound.gameWin(); else sound.gameLose();
      } else {
        // PvP: record from player1 perspective
        addResult(recordKey, gameState.result.winner === 'player1' ? 'win' : 'loss');
        sound.gameWin();
      }
    }
    prevPhaseRef.current = gameState.phase;
  }, [gameState.phase, gameState.result, mode, aiPlayer, recordKey, addResult, sound]);

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
    gameState.phase !== 'trapping' &&
    !isAnimating;

  // AI trap placement.
  const isAITrapping =
    aiPlayer !== null &&
    gameState.currentPlayer === aiPlayer &&
    gameState.phase === 'trapping';

  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    if (!isAITrapping) return;
    // AI places all traps at once, then confirms — so positions are never visible.
    const { board, boardSize, trapLimit, traps, currentPlayer } = gameState;
    const placed = traps.filter((t) => t.placedBy === currentPlayer).length;
    const remaining = trapLimit - placed;
    if (remaining <= 0) {
      dispatch({ type: 'confirmTraps' });
      return;
    }
    const candidates: CellCoord[] = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const cell = board[r][c];
        if (cell.state !== 'empty') continue;
        if (traps.some((t) => t.placedBy === currentPlayer && t.coord.row === r && t.coord.col === c)) continue;
        candidates.push({ row: r, col: c });
      }
    }
    // Shuffle candidates.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const tileTypes: TileType[] = ['curve_ul', 'curve_ur', 'cross'];
    const count = Math.min(remaining, candidates.length);
    for (let i = 0; i < count; i++) {
      const blockedTile = tileTypes[Math.floor(Math.random() * tileTypes.length)];
      dispatch({ type: 'placeTrap', coord: candidates[i], blockedTile });
    }
    dispatch({ type: 'confirmTraps' });
  }, [isAITrapping, gameState]);

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

  // ── Replay ──
  const replayState = useMemo((): GameState | null => {
    if (!replayMoves) return null;
    let s = createInitialState(gameState.boardSize);
    for (let i = 0; i < replayStep; i++) {
      s = applyMove(s, replayMoves[i]);
    }
    return s;
  }, [replayMoves, replayStep, gameState.boardSize]);

  const handleStartReplay = useCallback(() => {
    setReplayMoves(gameState.moveHistory);
    setReplayStep(0);
    setReplayPlaying(false);
  }, [gameState.moveHistory]);

  const handleStopReplay = useCallback(() => {
    setReplayMoves(null);
    setReplayStep(0);
    setReplayPlaying(false);
  }, []);

  useEffect(() => {
    if (!replayPlaying || !replayMoves) return;
    if (replayStep >= replayMoves.length) {
      setReplayPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setReplayStep((s) => s + 1);
    }, AUTO_FOLLOW_STEP_MS);
    return () => clearTimeout(timer);
  }, [replayPlaying, replayStep, replayMoves]);

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

  // ── Sound: play on move ──
  const prevMoveCountRef = useRef(moveCount);
  useEffect(() => {
    if (moveCount > prevMoveCountRef.current) {
      sound.placeTile();
    }
    prevMoveCountRef.current = moveCount;
  }, [moveCount, sound]);

  // ── Sound: timer warning at ≤5s ──
  const prevRemainingRef = useRef(turnRemaining);
  useEffect(() => {
    if (
      turnRemaining !== null &&
      turnRemaining <= 5 &&
      turnRemaining > 0 &&
      prevRemainingRef.current !== turnRemaining
    ) {
      sound.timerWarning();
    }
    prevRemainingRef.current = turnRemaining;
  }, [turnRemaining, sound]);

  const handleMove = useCallback(
    (move: Move) => dispatch({ type: 'move', move }),
    [],
  );
  const restartOpts = useCallback((overrides?: { boardSize?: number; missingCount?: number; trapLimit?: number }) => ({
    type: 'restart' as const,
    boardSize: overrides?.boardSize ?? boardSizeOption,
    missingCount: overrides?.missingCount ?? missingCountOption,
    trapLimit: overrides?.trapLimit ?? trapLimitOption,
  }), [boardSizeOption, missingCountOption, trapLimitOption]);

  const handleRestart = useCallback(() => {
    setReplayMoves(null);
    setReplayStep(0);
    setReplayPlaying(false);
    const opts = restartOpts();
    dispatch(opts);
    // Show pre-handoff for P1 if trapping is enabled in PvP.
    if ((opts.trapLimit ?? 0) > 0 && mode === 'pvp') {
      setShowHandoff('pre1');
    } else {
      setShowHandoff(null);
    }
  }, [restartOpts, mode]);
  const handleUndo = useCallback(() => {
    if (mode === 'pve' && state.history.length >= 2) {
      dispatch({ type: 'undo' });
      dispatch({ type: 'undo' });
    } else {
      dispatch({ type: 'undo' });
    }
  }, [mode, state.history.length]);
  const handleModeChange = useCallback((newMode: GameMode) => {
    setMode(newMode);
    if (newMode !== 'online') {
      room.leave();
      dispatch(restartOpts());
    }
  }, [restartOpts, room]);
  const handleSideChange = useCallback((side: PlayerSide) => {
    setPlayerSide(side);
    dispatch(restartOpts());
  }, [restartOpts]);
  const handleTimeLimitChange = useCallback((limit: TurnTimeLimit) => {
    setTurnTimeLimit(limit);
    dispatch(restartOpts());
  }, [restartOpts]);
  const handleBoardSizeChange = useCallback((size: BoardSizeOption) => {
    setBoardSizeOption(size);
    dispatch(restartOpts({ boardSize: size }));
  }, [restartOpts]);
  const handleMissingCountChange = useCallback((count: number) => {
    setMissingCountOption(count);
    dispatch(restartOpts({ missingCount: count }));
  }, [restartOpts]);
  const handleReroll = useCallback(() => {
    dispatch(restartOpts());
  }, [restartOpts]);
  const handleTrapLimitChange = useCallback((limit: number) => {
    setTrapLimitOption(limit);
    dispatch(restartOpts({ trapLimit: limit }));
  }, [restartOpts]);

  // ── Trap placement handlers ──
  const handlePlaceTrap = useCallback((coord: CellCoord, blockedTile: TileType) => {
    dispatch({ type: 'placeTrap', coord, blockedTile });
  }, []);
  const handleRemoveTrap = useCallback((coord: CellCoord) => {
    dispatch({ type: 'removeTrap', coord });
  }, []);
  const handleConfirmTraps = useCallback(() => {
    dispatch({ type: 'confirmTraps' });
    if (gameState.currentPlayer === 'player1' && aiPlayer !== 'player2') {
      setShowHandoff('player2');
    }
  }, [gameState.currentPlayer, aiPlayer]);
  const handleHandoffDismiss = useCallback(() => {
    setShowHandoff(null);
  }, []);

  // ── Online handlers ──
  const handleCreateRoom = useCallback(() => {
    room.create({
      boardSize: boardSizeOption,
      missingCount: missingCountOption,
      trapLimit: trapLimitOption,
      turnTimeLimit,
      missingSeed: Math.floor(Math.random() * 2147483647),
    });
  }, [room, boardSizeOption, missingCountOption, trapLimitOption, turnTimeLimit]);

  const handleLeaveRoom = useCallback(() => {
    room.leave();
  }, [room]);

  const handleOnlineLeave = useCallback(() => {
    room.leave();
  }, [room]);

  const replayProps = replayMoves ? {
    step: replayStep,
    total: replayMoves.length,
    playing: replayPlaying,
    onStart: handleStartReplay,
    onStop: handleStopReplay,
    onPrev: () => setReplayStep((s) => Math.max(0, s - 1)),
    onNext: () => setReplayStep((s) => Math.min(replayMoves.length, s + 1)),
    onTogglePlay: () => setReplayPlaying((p) => !p),
  } : {
    step: 0,
    total: gameState.moveHistory.length,
    playing: false,
    onStart: handleStartReplay,
    onStop: handleStopReplay,
    onPrev: () => {},
    onNext: () => {},
    onTogglePlay: () => {},
  };

  // ── Online mode rendering ──
  const renderOnlineContent = () => {
    // Game is actively playing or in trapping phase
    if (room.roomData && (room.roomData.status === 'playing' || room.roomData.status === 'trapping' || room.roomData.status === 'finished') && room.localPlayer) {
      return (
        <OnlineGame
          roomCode={room.roomCode!}
          roomData={room.roomData}
          localPlayer={room.localPlayer}
          onLeave={handleOnlineLeave}
        />
      );
    }

    // Both players joined — show room lobby
    if (room.phase === 'joined' && room.roomCode && room.roomData && room.localPlayer) {
      return (
        <RoomLobby
          roomCode={room.roomCode}
          roomData={room.roomData}
          localPlayer={room.localPlayer}
          isHost={room.localPlayer === 'player1'}
          onChangeSettings={(settings) => room.changeSettings(settings)}
          onStart={() => room.start()}
          onLeave={handleLeaveRoom}
        />
      );
    }

    // Waiting for guest to join
    if (room.phase === 'waiting' && room.roomCode) {
      return (
        <WaitingScreen
          roomCode={room.roomCode}
          onCancel={handleLeaveRoom}
        />
      );
    }

    // Default: show lobby (create/join)
    return (
      <Lobby
        onCreateRoom={handleCreateRoom}
        error={room.error}
        isCreating={room.phase === 'creating'}
      />
    );
  };

  return (
    <div className="app">
      <h1 className="title">Black Path Game</h1>
      {mode === 'online' ? (
        <div className="main-layout">
          <div className="board-area">
            {renderOnlineContent()}
          </div>
          <ControlPanel
            mode={mode}
            onModeChange={handleModeChange}
            aiDifficulty={aiDifficulty}
            onDifficultyChange={setAIDifficulty}
            playerSide={playerSide}
            onSideChange={handleSideChange}
            turnTimeLimit={turnTimeLimit}
            onTimeLimitChange={handleTimeLimitChange}
            boardSize={boardSizeOption}
            onBoardSizeChange={handleBoardSizeChange}
            missingCount={missingCountOption}
            onMissingCountChange={handleMissingCountChange}
            onReroll={handleReroll}
            trapLimit={trapLimitOption}
            onTrapLimitChange={handleTrapLimitChange}
            onRestart={handleRestart}
            canUndo={false}
            onUndo={handleUndo}
            onHelp={() => setShowHelp(true)}
            muted={sound.muted}
            onToggleMute={sound.toggleMute}
          />
        </div>
      ) : (
        <div className="main-layout">
          <div className="board-area">
            <HUD
              state={replayState ?? displayState}
              aiThinking={aiThinking}
              turnRemaining={turnRemaining}
              aiPlayer={aiPlayer}
              record={record}
              onRestart={handleRestart}
              replay={replayProps}
              isReplaying={replayMoves !== null}
            />
            <GameBoard
              state={replayState ?? interactiveState}
              onMove={handleMove}
              onUndo={handleUndo}
              onPlaceTrap={handlePlaceTrap}
              onRemoveTrap={handleRemoveTrap}
              onConfirmTraps={handleConfirmTraps}
              viewingPlayer={gameState.currentPlayer}
            />
          </div>
          <ControlPanel
            mode={mode}
            onModeChange={handleModeChange}
            aiDifficulty={aiDifficulty}
            onDifficultyChange={setAIDifficulty}
            playerSide={playerSide}
            onSideChange={handleSideChange}
            turnTimeLimit={turnTimeLimit}
            onTimeLimitChange={handleTimeLimitChange}
            boardSize={boardSizeOption}
            onBoardSizeChange={handleBoardSizeChange}
            missingCount={missingCountOption}
            onMissingCountChange={handleMissingCountChange}
            onReroll={handleReroll}
            trapLimit={trapLimitOption}
            onTrapLimitChange={handleTrapLimitChange}
            onRestart={handleRestart}
            canUndo={state.history.length > 0 && !isAnimating && !isAITurn}
            onUndo={handleUndo}
            onHelp={() => setShowHelp(true)}
            muted={sound.muted}
            onToggleMute={sound.toggleMute}
          />
        </div>
      )}
      {showHandoff !== null && (
        <div className="handoff-overlay" onClick={handleHandoffDismiss}>
          <div className="handoff-content">
            <p>
              {showHandoff === 'pre1'
                ? 'Player 1 が罠を配置します'
                : 'Player 2 に端末を渡してください'}
            </p>
            <button onClick={handleHandoffDismiss}>準備OK</button>
          </div>
        </div>
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
