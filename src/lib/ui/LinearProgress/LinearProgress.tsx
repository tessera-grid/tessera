import { memo } from 'react'
import clsx from 'clsx'

import styles from './LinearProgress.module.css'

/**
 * @description
 * Индикатор загрузки грида (ADR 0094): размытая полоса оттенков синего по нижней
 * границе шапки — цвета текут вдоль неё, яркость дышит и не гаснет.
 */
export const LinearProgress = memo(({ label }: { label: string }) => {
  return (
    <div
      className={clsx('data-grid__loader', styles['linear-progress'])}
      role="progressbar"
      aria-label={label}
    >
      <div
        className={clsx('data-grid__loader-glow', styles.glow, styles.flow)}
      />
      <div
        className={clsx('data-grid__loader-glow', styles.glow, styles.counter)}
      />
      <div className={clsx('data-grid__loader-line', styles.line)} />
    </div>
  )
})

LinearProgress.displayName = 'LinearProgress'
