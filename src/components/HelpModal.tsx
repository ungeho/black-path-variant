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
            <h3>目的</h3>
            <p>
              2人が交互にタイルを置いて道を延ばすゲームです。<br />
              <strong>自分の手番で道が盤の外に出たら負け</strong>です。
            </p>
          </section>

          <section>
            <h3>ゲームの流れ</h3>
            <ol>
              <li>盤面の左上に最初のタイルが置かれています</li>
              <li>道の先端にある<strong>光っているマス</strong>をクリックします</li>
              <li>3種類のタイルから1つを選んで置きます</li>
              <li>道が伸びて、相手の番になります</li>
              <li>道が盤外に出たプレイヤーが負けです</li>
            </ol>
          </section>

          <section>
            <h3>タイル</h3>
            <p>3種類あり、それぞれ道の向きが異なります。</p>
            <ul>
              <li><strong>曲線タイル (2種)</strong> — 道を左右どちらかに曲げる</li>
              <li><strong>十字タイル</strong> — 道をまっすぐ通す</li>
            </ul>
            <p>どのタイルを選ぶかで道の行き先が変わります。</p>
          </section>

          <section>
            <h3>特殊ルール</h3>
            <dl className={styles.featureList}>
              <dt>欠損マス</dt>
              <dd>タイルを置けない穴です。道がここに入っても負けになります。</dd>
              <dt>罠</dt>
              <dd>
                ゲーム開始前に、各プレイヤーが相手に見えないように罠を配置します。
                罠が置かれたマスでは、指定された1種類のタイルが選べなくなります。
              </dd>
              <dt>自動追従</dt>
              <dd>道の先にすでにタイルがある場合、自動的に通過します。</dd>
              <dt>制限時間</dt>
              <dd>設定されている場合、時間内に手を打たないと負けです。</dd>
            </dl>
          </section>

          <section>
            <h3>操作方法</h3>
            <ul>
              <li>光っているマスをクリック → タイルを選択</li>
              <li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> キーでタイルを即選択</li>
              <li><kbd>Esc</kbd> で選択キャンセル</li>
              <li><kbd>Ctrl+Z</kbd> で一手戻す（vs AI のみ）</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
