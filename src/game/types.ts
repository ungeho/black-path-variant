// ─── Player ───────────────────────────────────────────────

export type Player = 'player1' | 'player2';

/** Extensible player kind for future AI / online support. */
export type PlayerKind = 'localHuman' | 'localAI' | 'remoteHuman';

// ─── Direction ────────────────────────────────────────────

export type Direction = 'up' | 'right' | 'down' | 'left';

// ─── Tile ─────────────────────────────────────────────────

/**
 * Three tile types, each containing two path segments connecting
 * all four sides in pairs (Truchet tiling).
 *
 *   curve_ul : arcs in top-left & bottom-right corners
 *              path 0 = up ↔ left,   path 1 = down ↔ right
 *
 *   curve_ur : arcs in top-right & bottom-left corners
 *              path 0 = up ↔ right,  path 1 = down ↔ left
 *
 *   cross    : straight lines crossing
 *              path 0 = up ↔ down,   path 1 = left ↔ right
 */
export type TileType = 'curve_ul' | 'curve_ur' | 'cross';

export interface Tile {
  type: TileType;
  /** Who placed this tile. null for the pre-placed start cell. */
  placedBy: Player | null;
  /** Which of the two path segments have been traversed. */
  pathUsed: [boolean, boolean];
}

// ─── Coordinates ──────────────────────────────────────────

export interface CellCoord {
  row: number;
  col: number;
}

// ─── Board ────────────────────────────────────────────────

export type CellState = 'empty' | 'start' | 'missing';

export interface BoardCell {
  state: CellState;
  tile: Tile | null;
}

export type Board = BoardCell[][];

// ─── Trap ─────────────────────────────────────────────────

export interface Trap {
  coord: CellCoord;
  /** The tile type that becomes unavailable on this cell. */
  blockedTile: TileType;
  placedBy: Player;
}

// ─── Move ─────────────────────────────────────────────────

/** Serializable plain object — safe to send over the wire. */
export interface Move {
  coord: CellCoord;
  tileType: TileType;
}

// ─── Game phase / result ──────────────────────────────────

export type GamePhase = 'trapping' | 'opening' | 'playing' | 'finished';

export interface GameResult {
  winner: Player;
  reason: 'out_of_bounds' | 'missing_cell' | 'no_legal_moves' | 'timeout';
}

// ─── Game state ───────────────────────────────────────────

export interface GameState {
  board: Board;
  /** Board size (always square: N×N). */
  boardSize: number;
  currentPlayer: Player;
  /** The cell the path tip is currently at. */
  pathHead: CellCoord;
  /**
   * The side of pathHead from which the path entered.
   * null only before the very first move (opening).
   */
  incomingDirection: Direction | null;
  phase: GamePhase;
  result: GameResult | null;
  legalMoves: Move[];
  moveHistory: Move[];
  /** Ordered coordinates the path has visited (for drawing). */
  pathCoords: CellCoord[];
  /**
   * Number of cells auto-followed after the last move.
   * Used by UI to animate the auto-follow step by step.
   * 0 means no auto-follow occurred.
   */
  autoFollowCount: number;
  /** Traps placed by both players. */
  traps: Trap[];
  /** Maximum traps each player can place. 0 = traps disabled. */
  trapLimit: number;
}
