import type { TileType, Direction, Player } from '../game';
import { ALL_TILE_TYPES, TILE_PATHS } from '../game';
import { directionToPoint, arcPathD } from './tileSvg';
import styles from './TilePicker.module.css';

const PLAYER_NAMES: Record<Player, string> = {
  player1: 'Player 1',
  player2: 'Player 2',
};

const PLAYER_COLORS: Record<Player, string> = {
  player1: 'var(--p1)',
  player2: 'var(--p2)',
};

interface TilePickerProps {
  entryFrom: Direction;
  currentPlayer: Player;
  onSelect: (tileType: TileType) => void;
  onCancel: () => void;
}

export function TilePicker({ entryFrom, currentPlayer, onSelect, onCancel }: TilePickerProps) {
  const color = PLAYER_COLORS[currentPlayer];

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.picker}
        style={{ borderTop: `4px solid ${color}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.title}>
          <span className={styles.dot} style={{ background: color }} />
          {PLAYER_NAMES[currentPlayer]} — タイルを選択
        </div>
        <div className={styles.options}>
          {ALL_TILE_TYPES.map((tt, i) => (
            <button
              key={tt}
              className={styles.option}
              onClick={() => onSelect(tt)}
              title={`${tt} (${i + 1})`}
            >
              <svg viewBox="0 0 100 100" className={styles.optionSvg}>
                <TilePreview tileType={tt} entryFrom={entryFrom} />
              </svg>
              <span className={styles.shortcutHint}>{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TilePreview({
  tileType,
  entryFrom,
}: {
  tileType: TileType;
  entryFrom: Direction;
}) {
  const paths = TILE_PATHS[tileType];
  const isCross = tileType === 'cross';

  return (
    <g>
      {paths.map(([a, b], i) => {
        const isActive = a === entryFrom || b === entryFrom;
        const stroke = isActive ? '#e8e8e8' : '#3a4a60';
        const strokeWidth = isActive ? 8 : 4;

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
