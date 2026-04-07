import type { Player } from '../game';
import type { RoomData, RoomSettings } from '../firebase/roomService';
import type { BoardSizeOption, TurnTimeLimit } from '../App';
import { BOARD_SIZE_OPTIONS, TURN_TIME_OPTIONS } from '../App';
import styles from './RoomLobby.module.css';

interface RoomLobbyProps {
  roomCode: string;
  roomData: RoomData;
  localPlayer: Player;
  isHost: boolean;
  onChangeSettings: (settings: RoomSettings) => void;
  onStart: () => void;
  onLeave: () => void;
}

const MISSING_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const TRAP_OPTIONS = [0, 1, 2, 3, 4, 5];

export function RoomLobby({
  roomCode,
  roomData,
  localPlayer,
  isHost,
  onChangeSettings,
  onStart,
  onLeave,
}: RoomLobbyProps) {
  const { settings } = roomData;
  const hasGuest = !!roomData.guestId;

  const updateSetting = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value, missingSeed: key === 'missingCount' ? Math.floor(Math.random() * 2147483647) : settings.missingSeed });
  };

  return (
    <div className={styles.roomLobby}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.roomCodeLabel}>ルームコード</span>
        <span className={styles.roomCode}>{roomCode}</span>
      </div>

      {/* Player slots */}
      <div className={styles.players}>
        <div className={`${styles.playerSlot} ${localPlayer === 'player1' ? styles.playerSlotActive : ''}`}>
          <div className={styles.playerSlotLabel}>Player 1 (先手)</div>
          <div className={styles.playerSlotName}>
            ホスト
            {localPlayer === 'player1' && <span className={styles.youBadge}>YOU</span>}
          </div>
        </div>
        <div className={`${styles.playerSlot} ${localPlayer === 'player2' ? styles.playerSlotActive : ''}`}>
          <div className={styles.playerSlotLabel}>Player 2 (後手)</div>
          {hasGuest ? (
            <div className={styles.playerSlotName}>
              ゲスト
              {localPlayer === 'player2' && <span className={styles.youBadge}>YOU</span>}
            </div>
          ) : (
            <div className={styles.playerSlotEmpty}>待機中...</div>
          )}
        </div>
      </div>

      {/* Settings (host can edit, guest sees read-only) */}
      <div className={styles.settingsCard}>
        <div className={styles.settingsTitle}>
          ゲーム設定 {!isHost && '(ホストが設定中)'}
        </div>
        <div className={styles.settingsBody}>
          <SettingRow label="盤面サイズ">
            {isHost ? (
              <MiniButtonGroup
                items={[...BOARD_SIZE_OPTIONS]}
                active={settings.boardSize as BoardSizeOption}
                label={(s) => `${s}x${s}`}
                onChange={(s) => updateSetting('boardSize', s)}
              />
            ) : (
              <span className={styles.settingValue}>{settings.boardSize}x{settings.boardSize}</span>
            )}
          </SettingRow>

          <SettingRow label="欠損マス">
            {isHost ? (
              <MiniButtonGroup
                items={MISSING_OPTIONS}
                active={settings.missingCount}
                label={(n) => n === 0 ? 'なし' : `${n}`}
                onChange={(n) => updateSetting('missingCount', n)}
              />
            ) : (
              <span className={styles.settingValue}>{settings.missingCount === 0 ? 'なし' : settings.missingCount}</span>
            )}
          </SettingRow>

          <SettingRow label="罠">
            {isHost ? (
              <MiniButtonGroup
                items={TRAP_OPTIONS}
                active={settings.trapLimit}
                label={(n) => n === 0 ? 'なし' : `${n}`}
                onChange={(n) => updateSetting('trapLimit', n)}
              />
            ) : (
              <span className={styles.settingValue}>{settings.trapLimit === 0 ? 'なし' : settings.trapLimit}</span>
            )}
          </SettingRow>

          <SettingRow label="制限時間">
            {isHost ? (
              <MiniButtonGroup
                items={[...TURN_TIME_OPTIONS]}
                active={settings.turnTimeLimit as TurnTimeLimit}
                label={(t) => t === 0 ? 'なし' : `${t}s`}
                onChange={(t) => updateSetting('turnTimeLimit', t)}
              />
            ) : (
              <span className={styles.settingValue}>{settings.turnTimeLimit === 0 ? 'なし' : `${settings.turnTimeLimit}s`}</span>
            )}
          </SettingRow>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {isHost && (
          <button
            className={styles.startButton}
            disabled={!hasGuest}
            onClick={onStart}
          >
            ゲーム開始
          </button>
        )}
        <button className={styles.leaveButton} onClick={onLeave}>
          退出
        </button>
      </div>
    </div>
  );
}

// ─── Mini sub-components ──────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingLabel}>{label}</span>
      {children}
    </div>
  );
}

function MiniButtonGroup<T extends string | number>({
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
  // Reuse the ControlPanel button group styles. Import inline to avoid circular deps.
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      {items.map((item) => (
        <button
          key={String(item)}
          style={{
            padding: '4px 8px',
            fontSize: '0.68rem',
            fontWeight: 600,
            border: 'none',
            borderLeft: item === items[0] ? 'none' : '1px solid var(--border)',
            background: item === active ? 'var(--accent)' : 'var(--surface-light)',
            color: item === active ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={() => onChange(item)}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}
