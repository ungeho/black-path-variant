import type { GameState, Move, CellCoord } from './types';
import {
  isOutOfBounds,
  isMissingCell,
  getNextCoord,
  getOppositeDirection,
  getTileExitDirection,
  canEnterTile,
  compatibleTiles,
} from './rules';

/**
 * Compute all legal moves for the current game state.
 *
 * A move is required only when the path reaches an *empty* cell.
 * If the path reaches a cell with an unused path segment, it auto-follows
 * (handled in the engine, not here).
 */
export function getLegalMoves(state: GameState): Move[] {
  if (state.phase === 'finished') return [];

  if (state.phase === 'opening') {
    return getOpeningMoves();
  }

  return getPlayingMoves(state);
}

// ─── Opening ──────────────────────────────────────────────

function getOpeningMoves(): Move[] {
  // From START_CELL the path can go right→(0,1) or down→(1,0).
  const candidates: CellCoord[] = [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ];

  const moves: Move[] = [];
  for (const coord of candidates) {
    for (const tileType of compatibleTiles()) {
      moves.push({ coord, tileType });
    }
  }
  return moves;
}

// ─── Playing ──────────────────────────────────────────────

function getPlayingMoves(state: GameState): Move[] {
  const { pathHead, incomingDirection, board } = state;
  if (incomingDirection === null) return [];

  // Get exit direction from pathHead.
  const exitDir = getTileExitDirection(
    board[pathHead.row][pathHead.col].tile!.type,
    incomingDirection,
  );
  if (exitDir === null) return [];

  const nextCoord = getNextCoord(pathHead, exitDir);

  // Terminal checks.
  if (isOutOfBounds(nextCoord)) return [];
  if (isMissingCell(nextCoord)) return [];

  const cell = board[nextCoord.row][nextCoord.col];

  // If cell has a tile, check if an unused path is available.
  // If available → auto-follow (handled in engine); moves are for the cell
  // AFTER auto-follow completes. But we don't compute that here — the engine
  // does auto-follow in applyMove, then recomputes legalMoves.
  // For the state we receive, pathHead is always at the END of auto-follow,
  // so the next cell should be empty.
  if (cell.tile !== null) {
    // Path would enter a tile — check if there's a usable path.
    const entryFrom = getOppositeDirection(exitDir);
    if (canEnterTile(cell.tile, entryFrom)) {
      // This shouldn't happen if engine did auto-follow correctly,
      // but handle defensively: no move needed, engine will auto-follow.
      return [];
    }
    // Blocked — no available path from this direction.
    return [];
  }

  // Cell is empty — player must place a tile.
  return compatibleTiles().map((tileType) => ({
    coord: nextCoord,
    tileType,
  }));
}
