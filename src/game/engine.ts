import type {
  Board,
  BoardCell,
  CellCoord,
  Direction,
  GamePhase,
  GameResult,
  GameState,
  Move,
  Player,
  Tile,
  Trap,
  TileType,
} from './types';
import {
  BOARD_ROWS,
  START_CELL,
} from './constants';
import {
  coordsEqual,
  getNextCoord,
  getOppositeDirection,
  getTileExitDirection,
  getTileExit,
  getPathIndex,
  isOutOfBounds,
  isMissingCell,
} from './rules';
import { getLegalMoves } from './moveGenerator';

// ─── State creation ───────────────────────────────────────

export function createInitialState(
  boardSize: number = BOARD_ROWS,
  missingCount: number = 0,
  trapLimit: number = 0,
): GameState {
  const board = createEmptyBoard(boardSize, missingCount);
  const phase: GamePhase = trapLimit > 0 ? 'trapping' : 'opening';
  const state: GameState = {
    board,
    boardSize,
    currentPlayer: 'player1',
    pathHead: START_CELL,
    incomingDirection: null,
    phase,
    result: null,
    legalMoves: [],
    moveHistory: [],
    pathCoords: [{ ...START_CELL }],
    autoFollowCount: 0,
    traps: [],
    trapLimit,
  };
  if (phase === 'opening') {
    state.legalMoves = getLegalMoves(state);
  }
  return state;
}

// ─── Trap placement ──────────────────────────────────────

export function placeTrap(
  state: GameState,
  coord: CellCoord,
  blockedTile: TileType,
): GameState {
  if (state.phase !== 'trapping') return state;
  const player = state.currentPlayer;

  // Can't place on start or missing cells.
  const cell = state.board[coord.row][coord.col];
  if (cell.state === 'start' || cell.state === 'missing') return state;

  // Check limit for this player.
  const playerTraps = state.traps.filter((t) => t.placedBy === player);
  if (playerTraps.length >= state.trapLimit) return state;

  // One trap per player per cell.
  const existing = state.traps.find(
    (t) => t.placedBy === player && t.coord.row === coord.row && t.coord.col === coord.col,
  );
  if (existing) return state;

  const trap: Trap = { coord: { ...coord }, blockedTile, placedBy: player };
  return { ...state, traps: [...state.traps, trap] };
}

export function removeTrap(state: GameState, coord: CellCoord): GameState {
  if (state.phase !== 'trapping') return state;
  const player = state.currentPlayer;
  const newTraps = state.traps.filter(
    (t) => !(t.placedBy === player && t.coord.row === coord.row && t.coord.col === coord.col),
  );
  if (newTraps.length === state.traps.length) return state;
  return { ...state, traps: newTraps };
}

export function confirmTraps(state: GameState): GameState {
  if (state.phase !== 'trapping') return state;
  if (state.currentPlayer === 'player1') {
    // Switch to player2's trap placement.
    return { ...state, currentPlayer: 'player2' };
  }
  // Both players done — move to opening.
  const newState: GameState = {
    ...state,
    currentPlayer: 'player1',
    phase: 'opening',
  };
  newState.legalMoves = getLegalMoves(newState);
  return newState;
}

function createEmptyBoard(boardSize: number, missingCount: number): Board {
  // The bottom-right corner is always missing.
  const missingSet = new Set([`${boardSize - 1},${boardSize - 1}`]);

  if (missingCount > 0) {
    // Protected cells that must never be missing:
    // start (0,0) and its two opening-move neighbours (0,1), (1,0).
    const protectedKeys = new Set(['0,0', '0,1', '1,0']);

    // Build list of candidate cells for random missing (excluding already-missing and protected).
    const candidates: CellCoord[] = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const key = `${row},${col}`;
        if (!protectedKeys.has(key) && !missingSet.has(key)) {
          candidates.push({ row, col });
        }
      }
    }

    // Fisher-Yates shuffle to pick random cells.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const actualCount = Math.min(missingCount, candidates.length);
    for (const c of candidates.slice(0, actualCount)) {
      missingSet.add(`${c.row},${c.col}`);
    }
  }

  const board: Board = [];
  for (let row = 0; row < boardSize; row++) {
    const rowCells: BoardCell[] = [];
    for (let col = 0; col < boardSize; col++) {
      const key = `${row},${col}`;
      let cellState: BoardCell['state'] = 'empty';
      if (coordsEqual({ row, col }, START_CELL)) cellState = 'start';
      else if (missingSet.has(key)) cellState = 'missing';

      // Pre-place a cross tile on the start cell.
      const tile: Tile | null = cellState === 'start'
        ? { type: 'cross', placedBy: null, pathUsed: [false, false] }
        : null;

      rowCells.push({ state: cellState, tile });
    }
    board.push(rowCells);
  }
  return board;
}

// ─── Core: compute exit direction from pathHead ───────────

export function getExitFromHead(state: GameState): Direction | null {
  const { pathHead, incomingDirection, board } = state;
  if (incomingDirection === null) return null;

  const tile = board[pathHead.row][pathHead.col].tile;
  if (!tile) return null;
  return getTileExitDirection(tile.type, incomingDirection);
}

// ─── Move application ─────────────────────────────────────

/**
 * Apply a move to the game state, returning a new state.
 * Pure function — does not mutate the input.
 */
export function applyMove(prevState: GameState, move: Move): GameState {
  if (prevState.phase === 'finished') return prevState;

  // Validate move is legal.
  const isLegal = prevState.legalMoves.some(
    (m) =>
      m.coord.row === move.coord.row &&
      m.coord.col === move.coord.col &&
      m.tileType === move.tileType,
  );
  if (!isLegal) return prevState;

  // Clone board.
  const board = cloneBoard(prevState.board);
  const pathCoords = [...prevState.pathCoords];

  // ── 1. Handle start cell path usage in opening ──
  if (prevState.phase === 'opening') {
    markStartCellPath(board, move);
  }

  // ── 2. Place the new tile ──
  const entryFrom = computeEntryFrom(prevState, move);
  if (entryFrom === null) return prevState;

  const pathIdx = getPathIndex(move.tileType, entryFrom);
  if (pathIdx === null) return prevState;

  board[move.coord.row][move.coord.col] = {
    ...board[move.coord.row][move.coord.col],
    tile: {
      type: move.tileType,
      placedBy: prevState.currentPlayer,
      pathUsed: [pathIdx === 0, pathIdx === 1],
    },
  };

  pathCoords.push({ ...move.coord });

  // ── 3. Get exit from the placed tile ──
  const exitDir = getTileExitDirection(move.tileType, entryFrom);
  if (exitDir === null) return prevState;

  // ── 4. Auto-follow through existing tiles ──
  const follow = autoFollow(board, move.coord, entryFrom, exitDir, pathCoords, prevState.boardSize);

  // ── 5. Build new state ──
  const nextPlayer = prevState.currentPlayer === 'player1' ? 'player2' : 'player1';

  const newState: GameState = {
    board: follow.board,
    boardSize: prevState.boardSize,
    currentPlayer: nextPlayer,
    pathHead: follow.pathHead,
    incomingDirection: follow.incomingDirection,
    phase: 'playing' as GamePhase,
    result: null,
    legalMoves: [],
    moveHistory: [...prevState.moveHistory, move],
    pathCoords: follow.pathCoords,
    autoFollowCount: follow.followCount,
    traps: prevState.traps,
    trapLimit: prevState.trapLimit,
  };

  newState.legalMoves = getLegalMoves(newState);
  newState.result = evaluateTerminal(newState);
  if (newState.result) {
    newState.phase = 'finished';
  }

  return newState;
}

// ─── Auto-follow through existing tiles ───────────────────

interface FollowResult {
  board: Board;
  pathHead: CellCoord;
  incomingDirection: Direction;
  pathCoords: CellCoord[];
  followCount: number;
}

/**
 * After placing/traversing a tile, automatically follow the path through
 * any subsequent tiles that have an unused path segment from the entry
 * direction. Mutates `board` (path markings) and `pathCoords`.
 */
function autoFollow(
  board: Board,
  currentHead: CellCoord,
  headEntryFrom: Direction,
  headExitDir: Direction,
  pathCoords: CellCoord[],
  boardSize: number,
): FollowResult {
  let head = currentHead;
  let entryFrom = headEntryFrom;
  let exitDir = headExitDir;
  let followCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextCoord = getNextCoord(head, exitDir);

    // Stop if out of bounds or missing cell.
    if (isOutOfBounds(nextCoord, boardSize) || isMissingCell(nextCoord, board)) break;

    const cell = board[nextCoord.row][nextCoord.col];
    if (!cell.tile) break; // Empty cell — player must place a tile.

    // Try to enter the existing tile.
    const nextEntryFrom = getOppositeDirection(exitDir);
    const result = getTileExit(cell.tile.type, nextEntryFrom, cell.tile.pathUsed);
    if (result === null) break; // No available path — blocked.

    // Mark path as used (mutate the cloned board).
    const newPathUsed: [boolean, boolean] = [...cell.tile.pathUsed];
    newPathUsed[result.pathIndex] = true;
    board[nextCoord.row][nextCoord.col] = {
      ...cell,
      tile: { ...cell.tile, pathUsed: newPathUsed },
    };

    pathCoords.push({ ...nextCoord });
    head = nextCoord;
    entryFrom = nextEntryFrom;
    exitDir = result.exitDir;
    followCount++;
  }

  return { board, pathHead: head, incomingDirection: entryFrom, pathCoords, followCount };
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Mark the start cell's cross path as used when the first move
 * determines the direction.
 */
function markStartCellPath(board: Board, move: Move): void {
  const startTile = board[START_CELL.row][START_CELL.col].tile;
  if (!startTile) return;

  // Determine which path of the cross is used.
  let entryFrom: Direction;
  if (move.coord.row === 0 && move.coord.col === 1) {
    // Path goes right → uses left↔right path (path 1 on cross).
    entryFrom = 'left';
  } else {
    // Path goes down → uses up↔down path (path 0 on cross).
    entryFrom = 'up';
  }

  const idx = getPathIndex(startTile.type, entryFrom);
  if (idx === null) return;

  const newPathUsed: [boolean, boolean] = [...startTile.pathUsed];
  newPathUsed[idx] = true;
  board[START_CELL.row][START_CELL.col] = {
    ...board[START_CELL.row][START_CELL.col],
    tile: { ...startTile, pathUsed: newPathUsed },
  };
}

function computeEntryFrom(state: GameState, move: Move): Direction | null {
  if (state.phase === 'opening') {
    if (move.coord.row === 0 && move.coord.col === 1) return 'left';
    if (move.coord.row === 1 && move.coord.col === 0) return 'up';
    return null;
  }

  const exitDir = getExitFromHead(state);
  if (exitDir === null) return null;
  return getOppositeDirection(exitDir);
}

function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      tile: cell.tile
        ? { ...cell.tile, pathUsed: [...cell.tile.pathUsed] as [boolean, boolean] }
        : null,
    })),
  );
}

// ─── Terminal evaluation ──────────────────────────────────

export function evaluateTerminal(state: GameState): GameResult | null {
  if (state.legalMoves.length > 0) return null;
  if (state.phase !== 'playing') return null;

  // The player who just moved caused the terminal condition — they lose.
  // After applyMove, currentPlayer is already the NEXT player,
  // so the current player (who didn't cause the exit) wins.
  const winner: Player = state.currentPlayer;

  const exitDir = getExitFromHead(state);
  if (exitDir === null) {
    return { winner, reason: 'no_legal_moves' };
  }

  const nextCoord = getNextCoord(state.pathHead, exitDir);

  if (isOutOfBounds(nextCoord, state.boardSize)) {
    return { winner, reason: 'out_of_bounds' };
  }
  if (isMissingCell(nextCoord, state.board)) {
    return { winner, reason: 'missing_cell' };
  }

  // Blocked by a fully-used tile.
  return { winner, reason: 'no_legal_moves' };
}
