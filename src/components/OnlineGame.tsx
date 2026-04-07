import { useState, useCallback } from 'react';
import type { Player, Move, CellCoord, TileType } from '../game';
import type { RoomData } from '../firebase/roomService';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GameBoard } from './GameBoard';
import styles from './OnlineGame.module.css';

interface OnlineGameProps {
  roomCode: string;
  roomData: RoomData;
  localPlayer: Player;
  onLeave: () => void;
}

export function OnlineGame({ roomCode, roomData, localPlayer, onLeave }: OnlineGameProps) {
  const {
    gameState,
    sendMove,
    placeTrap,
    removeTrap,
    confirmTraps,
    isMyTurn,
    timeRemaining,
    opponentDisconnected,
    trappingStatus,
    localTraps,
    trapTimeRemaining,
  } = useOnlineGame(roomCode, roomData, localPlayer);

  const [showResult, setShowResult] = useState(true);
  const [trapWarning, setTrapWarning] = useState<string | null>(null);

  const handleConfirmTraps = useCallback(() => {
    const required = roomData.settings.trapLimit;
    if (localTraps.length < required) {
      setTrapWarning(`罠をあと${required - localTraps.length}個配置してください`);
      return;
    }
    setTrapWarning(null);
    confirmTraps();
  }, [localTraps.length, roomData.settings.trapLimit, confirmTraps]);

  if (!gameState) {
    return <div className={styles.wrapper}>読み込み中...</div>;
  }

  const isFinished = gameState.phase === 'finished';
  const iWon = isFinished && gameState.result?.winner === localPlayer;

  // ── Trapping phase UI ──
  if (trappingStatus.isTrapping) {
    const myConfirmed = trappingStatus.myTrapsConfirmed;
    const opponentConfirmed = trappingStatus.opponentTrapsConfirmed;

    // Build a temporary game state with local traps for the board display.
    const trapDisplayState = {
      ...gameState,
      traps: localTraps,
      currentPlayer: localPlayer,
      phase: 'trapping' as const,
    };

    return (
      <div className={styles.wrapper}>
        <div className={styles.roomInfo}>Room: {roomCode}</div>
        <div className={styles.statusBar}>
          <span>罠配置フェーズ ({localTraps.length}/{roomData.settings.trapLimit})</span>
          {trapTimeRemaining !== null && (
            <span className={`${styles.timer} ${trapTimeRemaining <= 10 ? styles.timerUrgent : ''}`}>
              {trapTimeRemaining}s
            </span>
          )}
        </div>

        <GameBoard
          state={trapDisplayState}
          onMove={() => {}}
          onUndo={() => {}}
          onPlaceTrap={myConfirmed ? undefined : (coord: CellCoord, blockedTile: TileType) => placeTrap(coord, blockedTile)}
          onRemoveTrap={myConfirmed ? undefined : (coord: CellCoord) => removeTrap(coord)}
          viewingPlayer={localPlayer}
        />

        <div className={styles.trapStatus}>
          {!myConfirmed ? (
            <>
              <span className={styles.trapStatusText}>
                罠を配置してください ({localTraps.length}/{roomData.settings.trapLimit})
              </span>
              <button className={styles.trapConfirmButton} onClick={handleConfirmTraps}>
                確定
              </button>
              {trapWarning && <span className={styles.trapWarningText}>{trapWarning}</span>}
            </>
          ) : !opponentConfirmed ? (
            <span className={styles.trapWaiting}>相手の罠配置を待っています...</span>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Main game UI ──
  const handleMove = (move: Move) => {
    if (isMyTurn) {
      sendMove(move);
    }
  };

  const turnLabel = isMyTurn ? 'あなたの番' : '相手の番';

  return (
    <div className={styles.wrapper}>
      <div className={styles.roomInfo}>Room: {roomCode}</div>

      <div className={styles.statusBar}>
        <span className={`${styles.turnIndicator} ${isMyTurn ? styles.myTurn : ''}`}>
          {isFinished ? '終了' : turnLabel}
        </span>
        {timeRemaining !== null && !isFinished && (
          <span className={`${styles.timer} ${timeRemaining <= 3 ? styles.timerUrgent : ''}`}>
            {timeRemaining}s
          </span>
        )}
        {opponentDisconnected && (
          <span className={styles.disconnected}>相手が切断しました</span>
        )}
      </div>
      {!isFinished && (
        <div className={styles.guideText}>
          {isMyTurn
            ? '光っているマスをクリック → タイルを選んで道を延ばす'
            : '相手がタイルを置くのを待っています...'}
        </div>
      )}

      <GameBoard
        state={gameState}
        onMove={handleMove}
        onUndo={() => {}}
        viewingPlayer={localPlayer}
      />

      {/* Result overlay */}
      {isFinished && showResult && (
        <div className={styles.resultOverlay} onClick={() => setShowResult(false)}>
          <div className={styles.resultCard} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.resultTitle} ${iWon ? styles.resultWin : styles.resultLose}`}>
              {iWon ? '勝利!' : '敗北...'}
            </div>
            <div className={styles.resultActions}>
              <button className={styles.resultLeaveButton} onClick={onLeave}>
                退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
