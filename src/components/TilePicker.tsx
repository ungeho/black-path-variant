import type { CSSProperties } from 'react';
import type { TileType, Direction, Player } from '../game';
import { ALL_TILE_TYPES, TILE_PATHS } from '../game';
import { directionToPoint, arcPathD } from './tileSvg';
import styles from './TilePicker.module.css';

interface TilePickerProps {
  entryFrom: Direction | null;
  currentPlayer: Player;
  onSelect: (tileType: TileType) => void;
  onCancel: () => void;
  style?: CSSProperties;
  /** When true, show a "block" visual (for trap placement). */
  trapMode?: boolean;
  /** Tile types blocked by traps — hidden from normal picker. */
  blockedTiles?: Set<TileType>;
}

const PLAYER_COLORS: Record<Player, string> = {
  player1: 'var(--p1)',
  player2: 'var(--p2)',
};

export function TilePicker({ entryFrom, currentPlayer, onSelect, style, trapMode, blockedTiles }: TilePickerProps) {
  const color = PLAYER_COLORS[currentPlayer];
  const visibleTiles = trapMode
    ? ALL_TILE_TYPES
    : ALL_TILE_TYPES.filter((tt) => !blockedTiles?.has(tt));

  return (
    <div
      className={styles.picker}
      style={{ borderTopColor: color, ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      {trapMode && <div className={styles.trapLabel}>封じるタイル:</div>}
      <div className={styles.options}>
        {visibleTiles.map((tt) => {
          const originalIndex = ALL_TILE_TYPES.indexOf(tt);
          return (
            <button
              key={tt}
              className={styles.option}
              onClick={() => onSelect(tt)}
              title={`${tt} (${originalIndex + 1})`}
            >
              <svg viewBox="0 0 100 100" className={styles.optionSvg}>
                <TilePreview tileType={tt} entryFrom={entryFrom} />
                {trapMode && (
                  <g opacity="0.85">
                    <line x1="15" y1="15" x2="85" y2="85" stroke="#e94560" strokeWidth="7" strokeLinecap="round" />
                    <line x1="85" y1="15" x2="15" y2="85" stroke="#e94560" strokeWidth="7" strokeLinecap="round" />
                  </g>
                )}
              </svg>
              <span className={styles.shortcutHint}>{originalIndex + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TilePreview({
  tileType,
  entryFrom,
}: {
  tileType: TileType;
  entryFrom: Direction | null;
}) {
  const paths = TILE_PATHS[tileType];
  const isCross = tileType === 'cross';

  return (
    <g>
      {paths.map(([a, b], i) => {
        const isActive = entryFrom !== null && (a === entryFrom || b === entryFrom);
        const stroke = entryFrom === null ? '#8a9ab0' : isActive ? '#e8e8e8' : '#3a4a60';
        const strokeWidth = entryFrom === null ? 6 : isActive ? 8 : 4;

        if (isCross) {
          const pa = directionToPoint(a);
          const pb = directionToPoint(b);
          return (
            <line
              key={i}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
            />
          );
        }

        return (
          <path
            key={i}
            d={arcPathD(a, b)}
            fill="none"
            stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
