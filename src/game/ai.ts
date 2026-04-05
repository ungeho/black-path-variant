import type { GameState, Move, Player } from './types';
import { applyMove, getExitFromHead } from './engine';
import type { CellCoord } from './types';

// ─── Public API ──────────────────────────────────────────

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export function selectAIMove(
  state: GameState,
  difficulty: AIDifficulty = 'easy',
): Move | null {
  const { legalMoves } = state;
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  switch (difficulty) {
    case 'easy':
      return randomMove(legalMoves);
    case 'medium':
      return fixedDepthSearch(state, 6);
    case 'hard':
      return iterativeDeepeningSearch(state, 3000);
  }
}

// ─── Easy: random ────────────────────────────────────────

function randomMove(moves: Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)];
}

// ─── Medium: fixed-depth minimax ─────────────────────────

function fixedDepthSearch(state: GameState, maxDepth: number): Move {
  const aiPlayer = state.currentPlayer;
  let best = state.legalMoves[0];
  let bestScore = -Infinity;

  for (const move of state.legalMoves) {
    const next = applyMove(state, move);
    const score = alphabeta(next, maxDepth - 1, -Infinity, Infinity, false, aiPlayer, 0);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// ─── Hard: iterative deepening with time limit ───────────

function iterativeDeepeningSearch(state: GameState, timeLimitMs: number): Move {
  const aiPlayer = state.currentPlayer;
  const deadline = performance.now() + timeLimitMs;

  let bestMove = state.legalMoves[0];
  // Store scores from previous iteration for move ordering.
  let moveScores = new Map<number, number>();

  // Start from depth 1, deepen until time runs out.
  for (let depth = 1; depth <= 60; depth++) {
    const ordered = orderMoves(state.legalMoves, moveScores);
    const scores = new Map<number, number>();
    let alpha = -Infinity;
    let currentBest = ordered[0];
    let currentBestScore = -Infinity;
    let timedOut = false;

    for (const move of ordered) {
      const next = applyMove(state, move);
      const score = alphabetaTimed(
        next, depth - 1, alpha, Infinity, false, aiPlayer, deadline, 0,
      );

      // Check timeout — discard partial results from this depth.
      if (performance.now() >= deadline) {
        timedOut = true;
        break;
      }

      const key = moveKey(move);
      scores.set(key, score);

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = move;
        alpha = Math.max(alpha, score);
      }
    }

    if (!timedOut) {
      // Completed this depth — update best move.
      bestMove = currentBest;
      moveScores = scores;

      // If we found a forced win, stop searching.
      if (currentBestScore >= WIN_SCORE - 100) break;
      // If we found a forced loss, stop (can't improve).
      if (currentBestScore <= -WIN_SCORE + 100) break;
    } else {
      break;
    }

    if (performance.now() >= deadline) break;
  }

  return bestMove;
}

function moveKey(move: Move): number {
  return move.coord.row * 800 + move.coord.col * 100 +
    (move.tileType === 'curve_ul' ? 0 : move.tileType === 'curve_ur' ? 1 : 2);
}

/** Order moves by scores from previous iteration (best first for maximizer). */
function orderMoves(moves: Move[], scores: Map<number, number>): Move[] {
  if (scores.size === 0) return moves;
  return [...moves].sort((a, b) => {
    const sa = scores.get(moveKey(a)) ?? 0;
    const sb = scores.get(moveKey(b)) ?? 0;
    return sb - sa; // Descending — best moves first.
  });
}

// ─── Alpha-beta (untimed, for medium) ────────────────────

function alphabeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player,
  ply: number,
): number {
  if (depth === 0 || state.phase === 'finished' || state.legalMoves.length === 0) {
    return evaluate(state, aiPlayer, ply);
  }

  if (maximizing) {
    let value = -Infinity;
    for (const move of state.legalMoves) {
      const next = applyMove(state, move);
      value = Math.max(value, alphabeta(next, depth - 1, alpha, beta, false, aiPlayer, ply + 1));
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const move of state.legalMoves) {
      const next = applyMove(state, move);
      value = Math.min(value, alphabeta(next, depth - 1, alpha, beta, true, aiPlayer, ply + 1));
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }
}

// ─── Alpha-beta (timed, for hard) ────────────────────────

function alphabetaTimed(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player,
  deadline: number,
  ply: number,
): number {
  if (performance.now() >= deadline) return 0;

  if (depth === 0 || state.phase === 'finished' || state.legalMoves.length === 0) {
    return evaluate(state, aiPlayer, ply);
  }

  if (maximizing) {
    let value = -Infinity;
    for (const move of state.legalMoves) {
      const next = applyMove(state, move);
      value = Math.max(value, alphabetaTimed(next, depth - 1, alpha, beta, false, aiPlayer, deadline, ply + 1));
      if (performance.now() >= deadline) return value;
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const move of state.legalMoves) {
      const next = applyMove(state, move);
      value = Math.min(value, alphabetaTimed(next, depth - 1, alpha, beta, true, aiPlayer, deadline, ply + 1));
      if (performance.now() >= deadline) return value;
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }
}

// ─── Evaluation ──────────────────────────────────────────

const WIN_SCORE = 100_000;

function evaluate(state: GameState, aiPlayer: Player, ply: number): number {
  // Terminal states — exact outcome.
  if (state.result) {
    // Prefer faster wins, slower losses.
    return state.result.winner === aiPlayer
      ? WIN_SCORE - ply
      : -WIN_SCORE + ply;
  }

  const isAITurn = state.currentPlayer === aiPlayer;
  const sign = isAITurn ? -1 : 1;

  let score = 0;

  const { pathHead, boardSize } = state;
  const maxIdx = boardSize - 1;
  const missingCell: CellCoord = { row: maxIdx, col: maxIdx };

  // 1. Distance to nearest edge — closer = more dangerous for current player.
  const distToNearestEdge = Math.min(
    pathHead.row,
    pathHead.col,
    maxIdx - pathHead.row,
    maxIdx - pathHead.col,
  );
  score += sign * (5 - distToNearestEdge) * 15;

  // 2. Distance to missing cell.
  const distToMissing =
    Math.abs(pathHead.row - missingCell.row) +
    Math.abs(pathHead.col - missingCell.col);
  score += sign * Math.max(0, 6 - distToMissing) * 12;

  // 3. Exit direction — steps to board edge in the exit direction.
  const exitDir = getExitFromHead(state);
  if (exitDir) {
    const steps = stepsToEdge(pathHead, exitDir, boardSize);
    score += sign * (boardSize - steps) * 18;

    // Extra penalty if exit points directly off the board (1 step away).
    if (steps <= 1) {
      score += sign * 40;
    }
  }

  // 4. Missing cell corner proximity — extremely dangerous zone.
  const cornerThreshold = Math.max(3, boardSize - 3);
  if (pathHead.row >= cornerThreshold && pathHead.col >= cornerThreshold) {
    const cornerDist = (maxIdx - pathHead.row) + (maxIdx - pathHead.col);
    score += sign * (4 - cornerDist) * 25;
  }

  // 5. Corner (0,0) proximity — also dangerous (path can loop back).
  if (pathHead.row <= 2 && pathHead.col <= 2) {
    const cornerDist = pathHead.row + pathHead.col;
    score += sign * (4 - cornerDist) * 15;
  }

  // 6. Edge cell — on any border row/col.
  if (distToNearestEdge === 0) {
    score += sign * 20;
  }

  return score;
}

function stepsToEdge(
  head: { row: number; col: number },
  dir: 'up' | 'down' | 'left' | 'right',
  boardSize: number,
): number {
  const maxIdx = boardSize - 1;
  switch (dir) {
    case 'up':    return head.row;
    case 'down':  return maxIdx - head.row;
    case 'left':  return head.col;
    case 'right': return maxIdx - head.col;
  }
}
