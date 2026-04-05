import type { GameMode, PlayerSide, TurnTimeLimit, BoardSizeOption } from '../App';
import { TURN_TIME_OPTIONS, BOARD_SIZE_OPTIONS } from '../App';
import type { AIDifficulty } from '../game';
import styles from './ControlPanel.module.css';

interface ControlPanelProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  aiDifficulty: AIDifficulty;
  onDifficultyChange: (d: AIDifficulty) => void;
  playerSide: PlayerSide;
  onSideChange: (side: PlayerSide) => void;
  turnTimeLimit: TurnTimeLimit;
  onTimeLimitChange: (limit: TurnTimeLimit) => void;
  boardSize: BoardSizeOption;
  onBoardSizeChange: (size: BoardSizeOption) => void;
  onRestart: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onHelp: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  pvp: '対人戦',
  pve: 'vs AI',
};

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const SIDE_LABELS: Record<PlayerSide, string> = {
  first: '先手',
  second: '後手',
};

function timeLimitLabel(t: TurnTimeLimit): string {
  return t === 0 ? 'なし' : `${t}s`;
}

export function ControlPanel({
  mode,
  onModeChange,
  aiDifficulty,
  onDifficultyChange,
  playerSide,
  onSideChange,
  turnTimeLimit,
  onTimeLimitChange,
  boardSize,
  onBoardSizeChange,
  onRestart,
  canUndo,
  onUndo,
  onHelp,
  muted,
  onToggleMute,
}: ControlPanelProps) {
  return (
    <div className={styles.panel}>
      {/* Row 1: mode + AI options */}
      <div className={styles.row}>
        <ButtonGroup
          items={Object.keys(MODE_LABELS) as GameMode[]}
          active={mode}
          label={(m) => MODE_LABELS[m]}
          onChange={onModeChange}
        />
        {mode === 'pve' && (
          <>
            <ButtonGroup
              items={Object.keys(DIFFICULTY_LABELS) as AIDifficulty[]}
              active={aiDifficulty}
              label={(d) => DIFFICULTY_LABELS[d]}
              onChange={(d) => { onDifficultyChange(d); onRestart(); }}
            />
            <ButtonGroup
              items={Object.keys(SIDE_LABELS) as PlayerSide[]}
              active={playerSide}
              label={(s) => SIDE_LABELS[s]}
              onChange={(s) => { onSideChange(s); }}
            />
          </>
        )}
      </div>

      {/* Row 2: board size + timer + actions */}
      <div className={styles.row}>
        <div className={styles.timerGroup}>
          <span className={styles.timerLabel}>盤面:</span>
          <ButtonGroup
            items={[...BOARD_SIZE_OPTIONS]}
            active={boardSize}
            label={(s) => `${s}×${s}`}
            onChange={onBoardSizeChange}
          />
        </div>
        <div className={styles.timerGroup}>
          <span className={styles.timerLabel}>制限時間:</span>
          <ButtonGroup
            items={[...TURN_TIME_OPTIONS]}
            active={turnTimeLimit}
            label={timeLimitLabel}
            onChange={onTimeLimitChange}
          />
        </div>
        <button className={styles.button} onClick={onRestart}>
          リスタート
        </button>
        <button className={styles.button} onClick={onUndo} disabled={!canUndo}>
          一手戻す
        </button>
        <button
          className={`${styles.button} ${styles.helpButton}`}
          onClick={onToggleMute}
          title={muted ? 'サウンドON' : 'サウンドOFF'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className={`${styles.button} ${styles.helpButton}`} onClick={onHelp}>
          ?
        </button>
      </div>
    </div>
  );
}

// ─── Generic button group ────────────────────────────────

function ButtonGroup<T extends string | number>({
  items,
  active,
  label,
  onChange,
}: {
  items: T[];
  active: T;
  label: (item: T) => string;
  onChange: (item: T) => void;
}) {
  return (
    <div className={styles.modeGroup}>
      {items.map((item) => (
        <button
          key={String(item)}
          className={`${styles.modeButton} ${item === active ? styles.modeActive : ''}`}
          onClick={() => onChange(item)}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}
