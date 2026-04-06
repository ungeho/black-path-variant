import { memo } from 'react';
import type { BoardCell, TileType, Direction, Tile } from '../game';
import { TILE_PATHS } from '../game';
import { directionToPoint, arcPathD } from './tileSvg';
import styles from './Cell.module.css';

interface CellProps {
  row: number;
  col: number;
  cell: BoardCell;
  isLegal: boolean;
  isPathHead: boolean;
  isOnPath: boolean;
  isLastMove: boolean;
  pathDirections: Direction[];
  exitArrowDir: Direction | null;
  onCellClick: (row: number, col: number) => void;
  isStart: boolean;
  isMissing: boolean;
  /** The tile type blocked by the viewing player's trap on this cell, if any. */
  trapTile: TileType | null;
}

function CellComponent({
  row,
  col,
  cell,
  isLegal,
  isPathHead,
  isOnPath,
  isLastMove,
  pathDirections,
  exitArrowDir,
  onCellClick,
  isStart,
  isMissing,
  trapTile,
}: CellProps) {

  if (isMissing) {
    const hatchId = `hatch-${row}-${col}`;
    return (
      <div className={styles.cell + ' ' + styles.missing}>
        <svg viewBox="0 0 100 100" className={styles.tileSvg}>
          <defs>
            <pattern id={hatchId} patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="14" stroke="#1e2d4a" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="#0d1117" />
          <rect width="100" height="100" fill={`url(#${hatchId})`} opacity="0.6" />
          <rect x="15" y="15" width="70" height="70" rx="6" fill="none" stroke="#2a3a5c" strokeWidth="1.5" strokeDasharray="5 4" />
        </svg>
      </div>
    );
  }

  const classNames = [
    styles.cell,
    isStart && styles.start,
    isOnPath && styles.onPath,
    isLegal && !cell.tile?.placedBy && styles.legal,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onClick={isLegal ? () => onCellClick(row, col) : undefined}
    >
      {/* Highlights rendered as separate elements to avoid box-shadow conflict */}
      {isPathHead && <div className={styles.pathHeadBorder} />}
      {isLastMove && <div className={styles.lastMoveBorder} />}

      <svg
        viewBox="0 0 100 100"
        className={`${styles.tileSvg} ${isLastMove ? styles.tileEnter : ''}`}
      >
        {cell.tile && (
          <TileGraphic
            tile={cell.tile}
            isOnPath={isOnPath}
            pathDirections={pathDirections}
            isStart={isStart}
          />
        )}
        {exitArrowDir && <ExitArrow direction={exitArrowDir} />}
        {trapTile && <TrapMarker />}
      </svg>
    </div>
  );
}

export const Cell = memo(CellComponent);

// ─── SVG sub-components ───────────────────────────────────

function TileGraphic({
  tile,
  isStart,
}: {
  tile: Tile;
  isOnPath: boolean;
  pathDirections: Direction[];
  isStart: boolean;
}) {
  const paths = TILE_PATHS[tile.type];

  // Determine which path segments have been traversed by the game path.
  const path0Active = tile.pathUsed[0];
  const path1Active = tile.pathUsed[1];

  return (
    <g>
      <PathSegment
        directions={paths[0]}
        tileType={tile.type}
        active={path0Active}
      />
      <PathSegment
        directions={paths[1]}
        tileType={tile.type}
        active={path1Active}
      />
      {isStart && <circle cx="50" cy="50" r="5" fill="#e94560" opacity="0.7" />}
    </g>
  );
}

function ExitArrow({ direction }: { direction: Direction }) {
  // Animated arrow pointing in the exit direction from center to edge.
  const angles: Record<Direction, number> = { up: -90, right: 0, down: 90, left: 180 };
  const angle = angles[direction];
  return (
    <g transform={`rotate(${angle} 50 50)`}>
      {/* Arrow shaft */}
      <line x1="50" y1="50" x2="95" y2="50"
        stroke="#e94560" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1s" repeatCount="indefinite" />
      </line>
      {/* Arrow head */}
      <polygon points="90,38 105,50 90,62"
        fill="#e94560" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1s" repeatCount="indefinite" />
      </polygon>
    </g>
  );
}

function PathSegment({
  directions,
  tileType,
  active,
}: {
  directions: [Direction, Direction];
  tileType: TileType;
  active: boolean;
}) {
  const [a, b] = directions;
  const pa = directionToPoint(a);
  const pb = directionToPoint(b);

  const isCross = tileType === 'cross';

  // Active path: bright white. Inactive: dim.
  const stroke = active ? '#e8e8e8' : '#3a4a60';
  const strokeWidth = active ? 7 : 3;

  if (isCross) {
    return (
      <line
        x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
      />
    );
  }

  // Quarter-circle arc connecting two adjacent sides.
  // The arc curves INWARD through the cell interior.
  return (
    <path
      d={arcPathD(a, b)}
      fill="none"
      stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
    />
  );
}

function TrapMarker() {
  return (
    <g>
      <circle cx="82" cy="18" r="14" fill="#e94560" opacity="0.85" />
      <line x1="74" y1="10" x2="90" y2="26" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="90" y1="10" x2="74" y2="26" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
