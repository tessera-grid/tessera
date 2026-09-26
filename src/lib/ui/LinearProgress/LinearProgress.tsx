import { memo } from 'react'

import styles from './LinearProgress.module.css'

/**
 * @description
 * Компонент лоадера для асинхронной загрузки в таблице.
 */
export const LinearProgress = memo(({ label }: { label: string }) => {
  return (
    <div
      className={styles['linear-progress']}
      role="progressbar"
      aria-label={label}
    >
      <div className={styles.bar} />
    </div>
  )
})

LinearProgress.displayName = 'LinearProgress'
