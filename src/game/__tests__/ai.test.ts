import { describe, it, expect } from 'vitest';
import { createInitialState, applyMove } from '../engine';
import { selectAIMove } from '../ai';
import type { AIDifficulty } from '../ai';

describe('AI', () => {
  it('easy returns a legal move', () => {
    const state = createInitialState();
    const move = selectAIMove(state, 'easy');
    expect(move).not.toBeNull();
    expect(state.legalMoves).toContainEqual(move);
  });

  it('medium returns a legal move', () => {
    const state = createInitialState();
    const move = selectAIMove(state, 'medium');
    expect(move).not.toBeNull();
    expect(state.legalMoves).toContainEqual(move);
  });

  it('hard returns a legal move', () => {
    const state = createInitialState();
    const move = selectAIMove(state, 'hard');
    expect(move).not.toBeNull();
    expect(state.legalMoves).toContainEqual(move);
  }, 10000);

  it('returns null when no legal moves', () => {
    const state = createInitialState();
    state.legalMoves = [];
    for (const d of ['easy', 'medium', 'hard'] as AIDifficulty[]) {
      expect(selectAIMove(state, d)).toBeNull();
    }
  });

  it('hard AI avoids instant-loss moves in opening', () => {
    const state = createInitialState();
    const move = selectAIMove(state, 'hard');
    expect(move).not.toBeNull();
    // curve_ul at (0,1) or (1,0) causes instant loss — hard AI should avoid these.
    const isInstantLoss =
      move!.tileType === 'curve_ul' &&
      ((move!.coord.row === 0 && move!.coord.col === 1) ||
       (move!.coord.row === 1 && move!.coord.col === 0));
    expect(isInstantLoss).toBe(false);
  }, 10000);

  it('medium AI plays valid moves through several turns', () => {
    let state = createInitialState();
    for (let i = 0; i < 10; i++) {
      if (state.phase === 'finished' || state.legalMoves.length === 0) break;
      const move = selectAIMove(state, 'medium');
      expect(move).not.toBeNull();
      expect(state.legalMoves).toContainEqual(move!);
      state = applyMove(state, move!);
    }
  });
});
