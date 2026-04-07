import { useState } from 'react';
import styles from './Lobby.module.css';

interface LobbyProps {
  onCreateRoom: () => void;
  error: string | null;
  isCreating: boolean;
}

export function Lobby({ onCreateRoom, error, isCreating }: LobbyProps) {
  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyTitle}>オンライン対戦</div>
      <div className={styles.options}>
        <div className={styles.optionCard} onClick={onCreateRoom}>
          <span className={styles.optionIcon}>+</span>
          <span className={styles.optionLabel}>ルーム作成</span>
          <span className={styles.optionHint}>URLを共有して対戦</span>
        </div>
      </div>
      {isCreating && <div className={styles.waitingHint}>ルーム作成中...</div>}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

interface WaitingScreenProps {
  roomCode: string;
  onCancel: () => void;
}

export function WaitingScreen({ roomCode, onCancel }: WaitingScreenProps) {
  const [copied, setCopied] = useState(false);

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.waitingScreen}>
      <div className={styles.lobbyTitle}>対戦相手を待っています</div>
      <div className={styles.roomCodeDisplay}>
        <span className={styles.roomCode}>{roomCode}</span>
      </div>
      <button className={styles.copyUrlButton} onClick={handleCopyUrl}>
        {copied ? 'コピーしました!' : '招待URLをコピー'}
      </button>
      <div className={styles.waitingHint}>URLを相手に送ってください</div>
      <button className={styles.backButton} onClick={onCancel}>
        キャンセル
      </button>
    </div>
  );
}
