import type { CellCoord, Direction, TileType } from './types';

// ─── Board dimensions ─────────────────────────────────────

export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

// ─── Special cells ────────────────────────────────────────

export const START_CELL: CellCoord = { row: 0, col: 0 };
export const MISSING_CELL: CellCoord = { row: 7, col: 7 };

// ─── Direction helpers ────────────────────────────────────

export const ALL_DIRECTIONS: readonly Direction[] = [
  'up',
  'right',
  'down',
  'left',
] as const;

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Row/col delta when moving in a direction. */
export const DIRECTION_DELTA: Record<Direction, { dRow: number; dCol: number }> = {
  up:    { dRow: -1, dCol:  0 },
  down:  { dRow:  1, dCol:  0 },
  left:  { dRow:  0, dCol: -1 },
  right: { dRow:  0, dCol:  1 },
};

// ─── Tile path map ────────────────────────────────────────

/**
 * Each tile has exactly two path segments, each connecting a pair of sides.
 * Together the two segments cover all four sides.
 *
 * Index 0 = first path,  Index 1 = second path.
 */
export const TILE_PATHS: Record<TileType, [[Direction, Direction], [Direction, Direction]]> = {
  curve_ul: [['up', 'left'],  ['down', 'right']],
  curve_ur: [['up', 'right'], ['down', 'left']],
  cross:    [['up', 'down'],  ['left', 'right']],
};

export const ALL_TILE_TYPES: readonly TileType[] = [
  'curve_ul',
  'curve_ur',
  'cross',
] as const;
