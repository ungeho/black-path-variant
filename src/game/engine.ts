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
} from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  START_CELL,
  MISSING_CELL,
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

export function createInitialState(): GameState {
  const board = createEmptyBoard();
  const state: GameState = {
    board,
    currentPlayer: 'player1',
    pathHead: START_CELL,
    incomingDirection: null,
    phase: 'opening',
    result: null,
    legalMoves: [],
    moveHistory: [],
    pathCoords: [{ ...START_CELL }],
    autoFollowCount: 0,
  };
  state.legalMoves = getLegalMoves(state);
  return state;
}

function createEmptyBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    const rowCells: BoardCell[] = [];
    for (let col = 0; col < BOARD_COLS; col++) {
      const coord: CellCoord = { row, col };
      let cellState: BoardCell['state'] = 'empty';
      if (coordsEqual(coord, START_CELL)) cellState = 'start';
      if (coordsEqual(coord, MISSING_CELL)) cellState = 'missing';

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
  const follow = autoFollow(board, move.coord, entryFrom, exitDir, pathCoords);

  // ── 5. Build new state ──
  const nextPlayer = prevState.currentPlayer === 'player1' ? 'player2' : 'player1';

  const newState: GameState = {
    board: follow.board,
    currentPlayer: nextPlayer,
    pathHead: follow.pathHead,
    incomingDirection: follow.incomingDirection,
    phase: 'playing' as GamePhase,
    result: null,
    legalMoves: [],
    moveHistory: [...prevState.moveHistory, move],
    pathCoords: follow.pathCoords,
    autoFollowCount: follow.followCount,
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
): FollowResult {
  let head = currentHead;
  let entryFrom = headEntryFrom;
  let exitDir = headExitDir;
  let followCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextCoord = getNextCoord(head, exitDir);

    // Stop if out of bounds or missing cell.
    if (isOutOfBounds(nextCoord) || isMissingCell(nextCoord)) break;

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

  if (isOutOfBounds(nextCoord)) {
    return { winner, reason: 'out_of_bounds' };
  }
  if (isMissingCell(nextCoord)) {
    return { winner, reason: 'missing_cell' };
  }

  // Blocked by a fully-used tile.
  return { winner, reason: 'no_legal_moves' };
}
