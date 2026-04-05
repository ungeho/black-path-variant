import styles from './HelpModal.module.css';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>ルール説明</h2>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          <section>
            <h3>概要</h3>
            <p>
              2人のプレイヤーが交互にタイルを置き、道を延ばしていくゲームです。
              自分が置いたタイルで道が<strong>盤外</strong>または
              <strong>右下の欠損マス</strong>に出てしまったプレイヤーが負けです。
            </p>
          </section>
          <section>
            <h3>タイルの種類</h3>
            <p>
              3種類のタイルがあり、それぞれ2本の経路を持っています。
              どのタイルも4辺すべてをカバーしているため、
              どの方向から入っても必ず出口があります。
            </p>
            <ul>
              <li><strong>曲線タイル (2種)</strong> — 隣り合う辺を弧で結ぶ</li>
              <li><strong>十字タイル</strong> — 上下・左右を直線で結ぶ</li>
            </ul>
          </section>
          <section>
            <h3>進行</h3>
            <ol>
              <li>左上 (0,0) にあらかじめ十字タイルが置かれています</li>
              <li>最初の手は (0,1) か (1,0) にタイルを置きます</li>
              <li>以降、道の先端にある空きマスにタイルを置いていきます</li>
              <li>既に置かれたタイルに道が入った場合、自動的に通過します</li>
            </ol>
          </section>
          <section>
            <h3>操作</h3>
            <ul>
              <li>光っているマスをクリック → タイルを選択</li>
              <li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> キーでタイルを即選択</li>
              <li><kbd>Esc</kbd> で選択キャンセル</li>
              <li><kbd>Ctrl+Z</kbd> で一手戻す</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
