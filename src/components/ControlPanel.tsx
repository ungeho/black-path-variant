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
  missingCount: number;
  onMissingCountChange: (count: number) => void;
  onReroll: () => void;
  trapLimit: number;
  onTrapLimitChange: (limit: number) => void;
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
  online: 'オンライン',
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

const MISSING_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const TRAP_LIMIT_OPTIONS = [0, 1, 2, 3, 4, 5];

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
  missingCount,
  onMissingCountChange,
  onReroll,
  trapLimit,
  onTrapLimitChange,
  onRestart,
  canUndo,
  onUndo,
  onHelp,
  muted,
  onToggleMute,
}: ControlPanelProps) {
  return (
    <div className={styles.sidebar}>
      {/* ── Actions card ── */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>操作</div>
        <div className={styles.cardBody}>
          <SettingRow label="モード">
            <ButtonGroup
              items={Object.keys(MODE_LABELS) as GameMode[]}
              active={mode}
              label={(m) => MODE_LABELS[m]}
              onChange={onModeChange}
            />
          </SettingRow>
          {mode === 'pve' && (
            <>
              <SettingRow label="AI強さ">
                <ButtonGroup
                  items={Object.keys(DIFFICULTY_LABELS) as AIDifficulty[]}
                  active={aiDifficulty}
                  label={(d) => DIFFICULTY_LABELS[d]}
                  onChange={(d) => { onDifficultyChange(d); onRestart(); }}
                />
              </SettingRow>
              <SettingRow label="手番">
                <ButtonGroup
                  items={Object.keys(SIDE_LABELS) as PlayerSide[]}
                  active={playerSide}
                  label={(s) => SIDE_LABELS[s]}
                  onChange={(s) => { onSideChange(s); }}
                />
              </SettingRow>
            </>
          )}
          <div className={styles.actionButtons}>
            <button className={styles.primaryButton} onClick={onRestart}>
              リスタート
            </button>
            {mode === 'pve' && (
              <button className={styles.secondaryButton} onClick={onUndo} disabled={!canUndo}>
                一手戻す
              </button>
            )}
            <button
              className={styles.iconButton}
              onClick={onToggleMute}
              title={muted ? 'サウンドON' : 'サウンドOFF'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className={styles.iconButton} onClick={onHelp}>
              ?
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings card ── */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>ゲーム設定</div>
        <div className={styles.cardBody}>
          <SettingRow label="盤面サイズ">
            <ButtonGroup
              items={[...BOARD_SIZE_OPTIONS]}
              active={boardSize}
              label={(s) => `${s}×${s}`}
              onChange={onBoardSizeChange}
            />
          </SettingRow>

          <SettingRow label="欠損マス" hint="右下固定+ランダム追加分">
            <ButtonGroup
              items={MISSING_COUNT_OPTIONS}
              active={missingCount}
              label={(n) => n === 0 ? 'なし' : `${n}`}
              onChange={onMissingCountChange}
            />
            {missingCount > 0 && (
              <button className={styles.tinyButton} onClick={onReroll}>
                振り直し
              </button>
            )}
          </SettingRow>

          <SettingRow label="罠" hint="各プレイヤーが置ける罠の数">
            <ButtonGroup
              items={TRAP_LIMIT_OPTIONS}
              active={trapLimit}
              label={(n) => n === 0 ? 'なし' : `${n}`}
              onChange={onTrapLimitChange}
            />
          </SettingRow>

          <SettingRow label="制限時間" hint="1手あたりの持ち時間">
            <ButtonGroup
              items={[...TURN_TIME_OPTIONS]}
              active={turnTimeLimit}
              label={timeLimitLabel}
              onChange={onTimeLimitChange}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingLabelRow}>
        <span className={styles.settingLabel}>{label}</span>
        {hint && <span className={styles.settingHint}>{hint}</span>}
      </div>
      <div className={styles.settingControls}>{children}</div>
    </div>
  );
}

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
    <div className={styles.btnGroup}>
      {items.map((item) => (
        <button
          key={String(item)}
          className={`${styles.btnGroupItem} ${item === active ? styles.btnGroupActive : ''}`}
          onClick={() => onChange(item)}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}
