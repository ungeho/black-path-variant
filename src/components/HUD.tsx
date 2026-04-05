import { useMemo, useState, useCallback } from 'react';
import type { GameState, Player } from '../game';
import type { WinRecord } from '../hooks/useRecord';
import styles from './HUD.module.css';

interface ReplayControls {
  step: number;
  total: number;
  playing: boolean;
  onStart: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}

interface HUDProps {
  state: GameState;
  aiThinking: boolean;
  turnRemaining: number | null;
  aiPlayer: Player | null;
  record: WinRecord;
  onRestart: () => void;
  replay: ReplayControls;
  isReplaying: boolean;
}

const PLAYER_COLORS: Record<Player, string> = {
  player1: 'var(--p1)',
  player2: 'var(--p2)',
};

const REASON_TEXT: Record<string, string> = {
  out_of_bounds: '道が盤外に出ました',
  missing_cell: '欠損マスに進みました',
  no_legal_moves: '合法手がありません',
  timeout: '時間切れ',
};

function playerLabel(player: Player, aiPlayer: Player | null): string {
  if (aiPlayer === null) {
    return player === 'player1' ? 'Player 1' : 'Player 2';
  }
  return player === aiPlayer ? 'AI' : 'あなた';
}

export function HUD({ state, aiThinking, turnRemaining, aiPlayer, record, onRestart, replay, isReplaying }: HUDProps) {
  const { phase, currentPlayer, result, moveHistory, board, boardSize } = state;
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    if (!result) return;
    const winner = playerLabel(result.winner, aiPlayer);
    const reason = REASON_TEXT[result.reason];
    const lines = [
      `Black Path Game`,
      `${boardSize}×${boardSize} | ${moveHistory.length}手`,
      `勝者: ${winner}（${reason}）`,
      `戦績: ${record.wins}W - ${record.losses}L`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, aiPlayer, boardSize, moveHistory.length, record]);

  const emptyCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (board[r][c].state !== 'missing' && board[r][c].tile === null) count++;
      }
    }
    return count;
  }, [board]);

  if (phase === 'finished' && result) {
    return (
      <div className={styles.hud}>
        {isReplaying ? (
          <div className={styles.replayBar}>
            <button className={styles.replayBtn} onClick={replay.onStop}>✕</button>
            <button className={styles.replayBtn} onClick={replay.onPrev} disabled={replay.step <= 0}>◀</button>
            <button className={styles.replayBtn} onClick={replay.onTogglePlay}>
              {replay.playing ? '⏸' : '▶'}
            </button>
            <button className={styles.replayBtn} onClick={replay.onNext} disabled={replay.step >= replay.total}>▶▶</button>
            <span className={styles.replayProgress}>
              {replay.step} / {replay.total}
            </span>
          </div>
        ) : (
          <div className={styles.resultCard}>
            <div className={styles.resultTitle}>GAME OVER</div>
            <div className={styles.winner}>
              <span
                className={styles.playerDot}
                style={{ background: PLAYER_COLORS[result.winner] }}
              />
              {playerLabel(result.winner, aiPlayer)} の勝ち！
            </div>
            <div className={styles.reason}>{REASON_TEXT[result.reason]}</div>
            <div className={styles.statsRow}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>手数</span>
                <span className={styles.statValue}>{moveHistory.length}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>戦績</span>
                <span className={styles.statValue}>
                  {record.wins}W - {record.losses}L
                </span>
              </div>
            </div>
            <div className={styles.resultActions}>
              <button className={styles.restartButton} onClick={onRestart}>
                もう一度
              </button>
              <button className={styles.replayStartButton} onClick={replay.onStart}>
                リプレイ
              </button>
              <button className={styles.replayStartButton} onClick={handleShare}>
                {copied ? 'コピー済み!' : 'シェア'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.hud}>
      <div
        className={styles.statusBar}
        style={{ borderLeftColor: PLAYER_COLORS[currentPlayer] }}
      >
        {/* Left: turn info */}
        <div className={styles.turnSection}>
          <span
            className={styles.playerDotLarge}
            style={{ background: PLAYER_COLORS[currentPlayer] }}
          />
          <div className={styles.turnText}>
            <span className={styles.turnName}>
              {playerLabel(currentPlayer, aiPlayer)}
            </span>
            <span className={styles.turnHint}>
              {phase === 'opening' ? '最初の一手' : 'の番'}
            </span>
          </div>
          {aiThinking && (
            <div className={styles.thinking}>
              <span className={styles.spinner} />
              <span>考え中…</span>
            </div>
          )}
        </div>

        {/* Center: timer (only shown when active) */}
        {turnRemaining !== null && !aiThinking && (
          <div className={`${styles.timerDisplay} ${turnRemaining <= 5 ? styles.timerUrgent : ''}`}>
            <span className={styles.timerNumber}>{turnRemaining}</span>
            <span className={styles.timerUnit}>秒</span>
          </div>
        )}

        {/* Right: stats */}
        <div className={styles.statsCompact}>
          <div className={styles.moveCount}>
            <span className={styles.moveNumber}>{moveHistory.length}</span>
            <span className={styles.moveLabel}>手目</span>
          </div>
          <div className={styles.moveCount}>
            <span className={styles.moveNumber}>{emptyCount}</span>
            <span className={styles.moveLabel}>空き</span>
          </div>
        </div>
      </div>
    </div>
  );
}
