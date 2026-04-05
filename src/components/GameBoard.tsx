import { useMemo, useCallback, useState, useEffect } from 'react';
import type { GameState, Move, TileType, CellCoord, Direction } from '../game';
import {
  ALL_TILE_TYPES,
  getExitFromHead,
  getOppositeDirection,
} from '../game';
import { Cell } from './Cell';
import { TilePicker } from './TilePicker';
import styles from './GameBoard.module.css';

interface GameBoardProps {
  state: GameState;
  onMove: (move: Move) => void;
  onUndo: () => void;
}

/** Reusable empty arrays to avoid re-creating on every render. */
const EMPTY_DIRECTIONS: Direction[] = [];

export function GameBoard({ state, onMove, onUndo }: GameBoardProps) {
  const { board, legalMoves, pathHead, moveHistory, pathCoords, boardSize } = state;

  // ── Selected cell for tile picker ──
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);

  // Set of legal cell keys.
  const legalCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      set.add(`${m.coord.row},${m.coord.col}`);
    }
    return set;
  }, [legalMoves]);

  // Last move coord.
  const lastMoveCoord = moveHistory.length > 0
    ? moveHistory[moveHistory.length - 1].coord
    : null;

  // Set of path coordinates.
  const pathSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of pathCoords) {
      set.add(`${c.row},${c.col}`);
    }
    return set;
  }, [pathCoords]);

  // Path directions for each cell on the path.
  const pathDirectionsMap = useMemo(
    () => computePathDirections(pathCoords),
    [pathCoords],
  );

  // Entry direction for legal cells (for tile picker preview).
  const entryFromForLegal = useMemo((): Direction | null => {
    if (legalMoves.length === 0) return null;
    const exitDir = getExitFromHead(state);
    if (exitDir === null) {
      // Opening: determine from the legal move coords.
      const m = legalMoves[0];
      if (m.coord.col === 1) return 'left';
      return 'up';
    }
    return getOppositeDirection(exitDir);
  }, [state, legalMoves]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const key = `${row},${col}`;
      if (legalCellSet.has(key)) {
        setSelectedCell({ row, col });
      }
    },
    [legalCellSet],
  );

  const handleTileSelect = useCallback(
    (tileType: TileType) => {
      if (selectedCell) {
        onMove({ coord: selectedCell, tileType });
        setSelectedCell(null);
      }
    },
    [selectedCell, onMove],
  );

  const handlePickerCancel = useCallback(() => setSelectedCell(null), []);

  // Clear selection when state changes (undo/restart).
  useEffect(() => setSelectedCell(null), [moveHistory.length]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Z / Cmd+Z → undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }

      // Escape → close tile picker
      if (e.key === 'Escape' && selectedCell) {
        setSelectedCell(null);
        return;
      }

      // 1/2/3 → select tile when picker is open
      if (selectedCell && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const idx = Number(e.key) - 1;
        if (idx < ALL_TILE_TYPES.length) {
          onMove({ coord: selectedCell, tileType: ALL_TILE_TYPES[idx] });
          setSelectedCell(null);
        }
        return;
      }

      // If no picker open and only one legal cell, auto-open on any number key
      if (!selectedCell && legalMoves.length > 0) {
        const firstCoord = legalMoves[0].coord;
        const allSameCell = legalMoves.every(
          (m) => m.coord.row === firstCoord.row && m.coord.col === firstCoord.col,
        );
        if (allSameCell && (e.key === '1' || e.key === '2' || e.key === '3')) {
          const idx = Number(e.key) - 1;
          if (idx < ALL_TILE_TYPES.length) {
            onMove({ coord: firstCoord, tileType: ALL_TILE_TYPES[idx] });
          }
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, legalMoves, onMove, onUndo]);

  // Compute exit arrow direction for game-over visualization.
  const exitArrowDir = useMemo((): Direction | null => {
    if (state.phase !== 'finished') return null;
    if (!state.result) return null;
    const { reason } = state.result;
    if (reason === 'out_of_bounds' || reason === 'missing_cell') {
      return getExitFromHead(state);
    }
    return null;
  }, [state]);

  // Build cell elements.
  const cells = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const key = `${row},${col}`;
      const isHead = row === pathHead.row && col === pathHead.col;
      cells.push(
        <Cell
          key={key}
          row={row}
          col={col}
          cell={board[row][col]}
          isLegal={legalCellSet.has(key)}
          isPathHead={isHead}
          isOnPath={pathSet.has(key)}
          isLastMove={lastMoveCoord !== null && row === lastMoveCoord.row && col === lastMoveCoord.col}
          pathDirections={pathDirectionsMap.get(key) ?? EMPTY_DIRECTIONS}
          exitArrowDir={isHead ? exitArrowDir : null}
          onCellClick={handleCellClick}
          isStart={row === 0 && col === 0}
          isMissing={row === boardSize - 1 && col === boardSize - 1}
        />,
      );
    }
  }

  // Build column labels (top row).
  const colLabels = [];
  colLabels.push(<div key="corner" className={styles.corner} />);
  for (let col = 0; col < boardSize; col++) {
    colLabels.push(
      <div key={`col-${col}`} className={styles.colLabel}>{col}</div>,
    );
  }

  // Build row labels (left column).
  const rowLabels = [];
  for (let row = 0; row < boardSize; row++) {
    rowLabels.push(
      <div
        key={`row-${row}`}
        className={styles.rowLabel}
        style={{ gridColumn: 1, gridRow: row + 2 }}
      >
        {row}
      </div>,
    );
  }

  // Compute inline picker position relative to the board.
  const pickerPosition = useMemo(() => {
    if (!selectedCell) return null;
    const cellSize = boardSize <= 6 ? 68 : boardSize <= 8 ? 68 : 52;
    const pickerWidth = 220;
    let left = selectedCell.col * cellSize + cellSize / 2 - pickerWidth / 2;
    let top = (selectedCell.row + 1) * cellSize + 4;
    const boardWidth = boardSize * cellSize;
    if (left + pickerWidth > boardWidth) left = boardWidth - pickerWidth;
    if (left < 0) left = 0;
    const boardHeight = boardSize * cellSize;
    if (top + 90 > boardHeight) {
      top = selectedCell.row * cellSize - 90;
    }
    return { top, left };
  }, [selectedCell, boardSize]);

  const cellSize = boardSize <= 8 ? 68 : 52;

  return (
    <>
      <div
        className={styles.wrapper}
        style={{
          gridTemplateColumns: `24px repeat(${boardSize}, ${cellSize}px)`,
          gridTemplateRows: `24px repeat(${boardSize}, ${cellSize}px)`,
        }}
      >
        {colLabels}
        {rowLabels}
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${boardSize}, ${cellSize}px)`,
          }}
        >
          {cells}
          {selectedCell && entryFromForLegal && pickerPosition && (
            <TilePicker
              entryFrom={entryFromForLegal}
              currentPlayer={state.currentPlayer}
              onSelect={handleTileSelect}
              onCancel={handlePickerCancel}
              style={{ position: 'absolute', top: pickerPosition.top, left: pickerPosition.left, zIndex: 10 }}
            />
          )}
        </div>
      </div>
      {/* Backdrop to close picker on outside click */}
      {selectedCell && (
        <div className={styles.pickerBackdrop} onClick={handlePickerCancel} />
      )}
    </>
  );
}

// ─── Path direction computation ───────────────────────────

function computePathDirections(
  pathCoords: CellCoord[],
): Map<string, Direction[]> {
  const map = new Map<string, Direction[]>();

  for (let i = 0; i < pathCoords.length; i++) {
    const curr = pathCoords[i];
    const key = `${curr.row},${curr.col}`;
    const dirs: Direction[] = [];

    if (i > 0) {
      const prev = pathCoords[i - 1];
      dirs.push(coordToDirection(curr, prev));
    }
    if (i < pathCoords.length - 1) {
      const next = pathCoords[i + 1];
      dirs.push(coordToDirection(curr, next));
    }

    const existing = map.get(key) ?? [];
    map.set(key, [...existing, ...dirs]);
  }

  return map;
}

function coordToDirection(from: CellCoord, to: CellCoord): Direction {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1) return 'up';
  if (dr === 1) return 'down';
  if (dc === -1) return 'left';
  return 'right';
}
