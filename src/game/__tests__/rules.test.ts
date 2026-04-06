import { describe, it, expect } from 'vitest';
import {
  isOutOfBounds,
  isMissingCell,
  getNextCoord,
  getOppositeDirection,
  getTileExitDirection,
  getPathIndex,
  canEnterTile,
  getTileExit,
  compatibleTiles,
} from '../rules';
import type { Board, BoardCell, Tile } from '../types';

function makeBoard(size: number, missingCoords: [number, number][] = []): Board {
  const missingSet = new Set(missingCoords.map(([r, c]) => `${r},${c}`));
  const board: Board = [];
  for (let r = 0; r < size; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < size; c++) {
      row.push({ state: missingSet.has(`${r},${c}`) ? 'missing' : 'empty', tile: null });
    }
    board.push(row);
  }
  return board;
}

describe('isOutOfBounds', () => {
  it('detects out-of-bounds coordinates', () => {
    expect(isOutOfBounds({ row: -1, col: 0 })).toBe(true);
    expect(isOutOfBounds({ row: 0, col: -1 })).toBe(true);
    expect(isOutOfBounds({ row: 8, col: 0 })).toBe(true);
    expect(isOutOfBounds({ row: 0, col: 8 })).toBe(true);
  });

  it('accepts in-bounds coordinates', () => {
    expect(isOutOfBounds({ row: 0, col: 0 })).toBe(false);
    expect(isOutOfBounds({ row: 7, col: 7 })).toBe(false);
    expect(isOutOfBounds({ row: 3, col: 4 })).toBe(false);
  });
});

describe('isMissingCell', () => {
  it('identifies a missing cell on the board', () => {
    const board = makeBoard(8, [[7, 7], [3, 4]]);
    expect(isMissingCell({ row: 7, col: 7 }, board)).toBe(true);
    expect(isMissingCell({ row: 3, col: 4 }, board)).toBe(true);
  });

  it('rejects non-missing cells', () => {
    const board = makeBoard(8, [[7, 7]]);
    expect(isMissingCell({ row: 0, col: 0 }, board)).toBe(false);
    expect(isMissingCell({ row: 7, col: 6 }, board)).toBe(false);
  });
});

describe('getNextCoord', () => {
  it('moves in each direction', () => {
    const c = { row: 3, col: 4 };
    expect(getNextCoord(c, 'up')).toEqual({ row: 2, col: 4 });
    expect(getNextCoord(c, 'down')).toEqual({ row: 4, col: 4 });
    expect(getNextCoord(c, 'left')).toEqual({ row: 3, col: 3 });
    expect(getNextCoord(c, 'right')).toEqual({ row: 3, col: 5 });
  });
});

describe('getOppositeDirection', () => {
  it('returns opposites', () => {
    expect(getOppositeDirection('up')).toBe('down');
    expect(getOppositeDirection('down')).toBe('up');
    expect(getOppositeDirection('left')).toBe('right');
    expect(getOppositeDirection('right')).toBe('left');
  });
});

describe('getTileExitDirection', () => {
  it('cross: up entry exits down', () => {
    expect(getTileExitDirection('cross', 'up')).toBe('down');
    expect(getTileExitDirection('cross', 'left')).toBe('right');
  });

  it('curve_ul: left entry exits up', () => {
    expect(getTileExitDirection('curve_ul', 'left')).toBe('up');
    expect(getTileExitDirection('curve_ul', 'up')).toBe('left');
  });

  it('curve_ul: down entry exits right', () => {
    expect(getTileExitDirection('curve_ul', 'down')).toBe('right');
    expect(getTileExitDirection('curve_ul', 'right')).toBe('down');
  });

  it('curve_ur: up entry exits right', () => {
    expect(getTileExitDirection('curve_ur', 'up')).toBe('right');
    expect(getTileExitDirection('curve_ur', 'right')).toBe('up');
  });
});

describe('getPathIndex', () => {
  it('returns correct path index for cross', () => {
    expect(getPathIndex('cross', 'up')).toBe(0);
    expect(getPathIndex('cross', 'down')).toBe(0);
    expect(getPathIndex('cross', 'left')).toBe(1);
    expect(getPathIndex('cross', 'right')).toBe(1);
  });

  it('returns correct path index for curve_ul', () => {
    expect(getPathIndex('curve_ul', 'up')).toBe(0);
    expect(getPathIndex('curve_ul', 'left')).toBe(0);
    expect(getPathIndex('curve_ul', 'down')).toBe(1);
    expect(getPathIndex('curve_ul', 'right')).toBe(1);
  });
});

describe('canEnterTile', () => {
  it('allows entry on unused path', () => {
    const tile: Tile = { type: 'cross', placedBy: 'player1', pathUsed: [false, true] };
    expect(canEnterTile(tile, 'up')).toBe(true);    // path 0, unused
    expect(canEnterTile(tile, 'left')).toBe(false);  // path 1, used
  });
});

describe('getTileExit', () => {
  it('returns exit when path is available', () => {
    expect(getTileExit('cross', 'up', [false, false])).toEqual({ pathIndex: 0, exitDir: 'down' });
  });

  it('returns null when path is used', () => {
    expect(getTileExit('cross', 'up', [true, false])).toBeNull();
  });
});

describe('compatibleTiles', () => {
  it('always returns all 3 tile types', () => {
    expect(compatibleTiles()).toHaveLength(3);
  });
});
