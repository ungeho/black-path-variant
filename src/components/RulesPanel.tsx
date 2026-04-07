import { useState } from 'react';
import styles from './RulesPanel.module.css';

export function RulesPanel() {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.panel}>
      <button className={styles.toggle} onClick={() => setOpen(!open)}>
        <span className={styles.toggleIcon}>{open ? '◀' : '▶'}</span>
        <span className={styles.toggleLabel}>ルール</span>
      </button>

      {open && (
        <div className={styles.content}>
          <Section title="目的" defaultOpen>
            <p>
              2人が交互にタイルを置いて道を延ばすゲームです。<br />
              <strong className={styles.keyPoint}>自分の手番で道が盤の外に出たら負け。</strong>
            </p>
          </Section>

          <Section title="遊び方" defaultOpen>
            <ol>
              <li><strong>光っているマス</strong>をクリック</li>
              <li>3種類のタイルから1つを選ぶ</li>
              <li>道が伸びて相手の番に</li>
            </ol>
          </Section>

          <Section title="タイル">
            <ul>
              <li><strong>曲線 (2種)</strong> — 道を曲げる</li>
              <li><strong>十字</strong> — 道をまっすぐ通す</li>
            </ul>
          </Section>

          <Section title="特殊ルール">
            <dl>
              <dt>欠損マス</dt>
              <dd>タイルを置けない穴。ここに道が入っても負け。</dd>
              <dt>罠</dt>
              <dd>ゲーム前に各プレイヤーが秘密に配置。そのマスで1種類のタイルが使用不可に。</dd>
              <dt>制限時間</dt>
              <dd>時間内に手を打たないと負け。</dd>
            </dl>
          </Section>

          <Section title="操作">
            <ul>
              <li>マスをクリック → タイルを選択</li>
              <li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> でタイル即選択</li>
              <li><kbd>Esc</kbd> でキャンセル</li>
              <li><kbd>Ctrl+Z</kbd> で一手戻す（AI戦のみ）</li>
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span className={styles.sectionArrow}>{open ? '▾' : '▸'}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}
