import type { CellCoord, Direction, Tile, TileType } from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  MISSING_CELL,
  OPPOSITE_DIRECTION,
  DIRECTION_DELTA,
  TILE_PATHS,
  ALL_TILE_TYPES,
} from './constants';

// ─── Coordinate helpers ───────────────────────────────────

export function isOutOfBounds(coord: CellCoord): boolean {
  return (
    coord.row < 0 ||
    coord.row >= BOARD_ROWS ||
    coord.col < 0 ||
    coord.col >= BOARD_COLS
  );
}

export function isMissingCell(coord: CellCoord): boolean {
  return coord.row === MISSING_CELL.row && coord.col === MISSING_CELL.col;
}

export function coordsEqual(a: CellCoord, b: CellCoord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function getNextCoord(coord: CellCoord, direction: Direction): CellCoord {
  const delta = DIRECTION_DELTA[direction];
  return { row: coord.row + delta.dRow, col: coord.col + delta.dCol };
}

// ─── Direction helpers ────────────────────────────────────

export function getOppositeDirection(dir: Direction): Direction {
  return OPPOSITE_DIRECTION[dir];
}

// ─── Tile path helpers ────────────────────────────────────

/**
 * Given a tile type and the side the path enters from,
 * returns the exit side (purely geometric — ignores pathUsed).
 */
export function getTileExitDirection(
  tileType: TileType,
  entryFrom: Direction,
): Direction | null {
  const paths = TILE_PATHS[tileType];
  for (const [a, b] of paths) {
    if (entryFrom === a) return b;
    if (entryFrom === b) return a;
  }
  return null;
}

/**
 * Returns the index (0 or 1) of the path segment that connects
 * from the given direction, or null if none.
 */
export function getPathIndex(
  tileType: TileType,
  entryFrom: Direction,
): number | null {
  const paths = TILE_PATHS[tileType];
  for (let i = 0; i < 2; i++) {
    const [a, b] = paths[i];
    if (entryFrom === a || entryFrom === b) return i;
  }
  return null;
}

/**
 * Check if a tile can be entered from the given direction
 * (i.e. the corresponding path segment is still unused).
 */
export function canEnterTile(tile: Tile, entryFrom: Direction): boolean {
  const idx = getPathIndex(tile.type, entryFrom);
  if (idx === null) return false;
  return !tile.pathUsed[idx];
}

/**
 * Try to traverse a tile from the given direction.
 * Returns the path index used and exit direction, or null if blocked.
 */
export function getTileExit(
  tileType: TileType,
  entryFrom: Direction,
  pathUsed: [boolean, boolean],
): { pathIndex: number; exitDir: Direction } | null {
  const idx = getPathIndex(tileType, entryFrom);
  if (idx === null) return null;
  if (pathUsed[idx]) return null;

  const [a, b] = TILE_PATHS[tileType][idx];
  const exitDir = entryFrom === a ? b : a;
  return { pathIndex: idx, exitDir };
}

/**
 * All 3 tile types are always compatible (every tile covers all 4 sides).
 */
export function compatibleTiles(): TileType[] {
  return [...ALL_TILE_TYPES];
}
