export type {
  Player,
  PlayerKind,
  Direction,
  TileType,
  Tile,
  CellCoord,
  CellState,
  BoardCell,
  Board,
  Move,
  GamePhase,
  GameResult,
  GameState,
} from './types';

export {
  BOARD_ROWS,
  BOARD_COLS,
  START_CELL,
  MISSING_CELL,
  ALL_TILE_TYPES,
  TILE_PATHS,
} from './constants';

export {
  isOutOfBounds,
  isMissingCell,
  coordsEqual,
  getNextCoord,
  getOppositeDirection,
  getTileExitDirection,
  getTileExit,
  getPathIndex,
  canEnterTile,
  compatibleTiles,
} from './rules';

export { getLegalMoves } from './moveGenerator';

export {
  createInitialState,
  applyMove,
  evaluateTerminal,
  getExitFromHead,
} from './engine';

export { selectAIMove } from './ai';
export type { AIDifficulty } from './ai';
