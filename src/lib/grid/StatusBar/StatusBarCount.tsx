/**
 * Счётчик нижней панели (ADR 0083, TX6–TX7): в полном виде панели — полная форма, в
 * компактном и двухстрочном — короткая. Текст элемента — всегда полная форма; короткая
 * рисуется псевдоэлементом и вспомогательным технологиям не видна. Обе не обрезаются.
 */
import styles from './StatusBarCount.module.css'

interface StatusBarCountProps {
  full: string
  short: string
  'data-testid'?: string
}

export const StatusBarCount = ({
  full,
  short,
  'data-testid': testId,
}: StatusBarCountProps) => (
  <span
    className={styles.count}
    data-testid={testId}
    data-status-count=""
    data-short={short}
  >
    <span className={styles.full}>{full}</span>
  </span>
)
