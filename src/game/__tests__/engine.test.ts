import { describe, it, expect } from 'vitest';
import { createInitialState, applyMove } from '../engine';

describe('createInitialState', () => {
  it('starts in opening phase with 6 legal moves', () => {
    const s = createInitialState();
    expect(s.phase).toBe('opening');
    expect(s.currentPlayer).toBe('player1');
    expect(s.legalMoves).toHaveLength(6); // 2 cells × 3 tile types
    expect(s.pathHead).toEqual({ row: 0, col: 0 });
    expect(s.autoFollowCount).toBe(0);
  });

  it('has a pre-placed cross tile on start cell', () => {
    const s = createInitialState();
    const startTile = s.board[0][0].tile;
    expect(startTile).not.toBeNull();
    expect(startTile!.type).toBe('cross');
    expect(startTile!.pathUsed).toEqual([false, false]);
  });
});

describe('applyMove - opening', () => {
  it('transitions to playing phase', () => {
    const s0 = createInitialState();
    const s1 = applyMove(s0, { coord: { row: 0, col: 1 }, tileType: 'cross' });
    expect(s1.phase).toBe('playing');
    expect(s1.currentPlayer).toBe('player2');
  });

  it('marks start cell cross path as used', () => {
    const s0 = createInitialState();
    // Place at (0,1) → uses left↔right path (path 1) on start cell
    const s1 = applyMove(s0, { coord: { row: 0, col: 1 }, tileType: 'cross' });
    expect(s1.board[0][0].tile!.pathUsed).toEqual([false, true]);
  });

  it('rejects illegal moves', () => {
    const s0 = createInitialState();
    const s1 = applyMove(s0, { coord: { row: 5, col: 5 }, tileType: 'cross' });
    expect(s1).toBe(s0); // same reference = no change
  });
});

describe('applyMove - terminal conditions', () => {
  it('detects out-of-bounds loss', () => {
    const s0 = createInitialState();
    // curve_ul at (0,1): enters from left, uses up↔left path, exits up → out of bounds
    const s1 = applyMove(s0, { coord: { row: 0, col: 1 }, tileType: 'curve_ul' });
    expect(s1.phase).toBe('finished');
    expect(s1.result).not.toBeNull();
    expect(s1.result!.reason).toBe('out_of_bounds');
    expect(s1.result!.winner).toBe('player2'); // player1 placed tile that sent path off-board → loses
  });
});

describe('applyMove - auto-follow', () => {
  it('auto-follows through existing tiles', () => {
    let s = createInitialState();

    // Move 1: curve_ur at (1,0) → enters from up, exits right → (1,1)
    s = applyMove(s, { coord: { row: 1, col: 0 }, tileType: 'curve_ur' });
    expect(s.pathHead).toEqual({ row: 1, col: 0 });

    // Move 2: cross at (1,1) → enters from left, exits right → (1,2)
    s = applyMove(s, { coord: { row: 1, col: 1 }, tileType: 'cross' });

    // Move 3: curve_ul at (1,2) → enters from left, exits up → (0,2)
    s = applyMove(s, { coord: { row: 1, col: 2 }, tileType: 'curve_ul' });

    // Move 4: curve_ur at (0,2) → enters from down, exits left → (0,1)
    s = applyMove(s, { coord: { row: 0, col: 2 }, tileType: 'curve_ur' });

    // Move 5: curve_ul at (0,1) → enters from right, exits down → (1,1)
    // (1,1) has cross with path 1 (left↔right) used. Path enters from up → uses path 0 (up↔down).
    // Auto-follows through (1,1), exits down → (2,1)
    s = applyMove(s, { coord: { row: 0, col: 1 }, tileType: 'curve_ul' });

    expect(s.autoFollowCount).toBe(1);
    expect(s.pathHead).toEqual({ row: 1, col: 1 });
    expect(s.board[1][1].tile!.pathUsed).toEqual([true, true]); // both paths used
    expect(s.pathCoords).toContainEqual({ row: 1, col: 1 }); // appears twice
  });
});

describe('moveHistory', () => {
  it('records all moves', () => {
    let s = createInitialState();
    s = applyMove(s, { coord: { row: 0, col: 1 }, tileType: 'cross' });
    s = applyMove(s, { coord: { row: 0, col: 2 }, tileType: 'cross' });
    expect(s.moveHistory).toHaveLength(2);
    expect(s.moveHistory[0].tileType).toBe('cross');
  });
});
