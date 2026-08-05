import { PropsWithChildren, memo } from 'react'

import clsx from 'clsx'

import styles from './BackgroundRow.module.css'

export interface BackgroundRowProps {
  rowIndex: number
}

/**
 * @description
 * Упрощенный компонент скелетона для deferred rendering строк при прокрутке таблицы.
 */
export const BackgroundRow = memo(
  ({ rowIndex, children }: PropsWithChildren<BackgroundRowProps>) => {
    return (
      <div
        className={clsx(
          'data-grid__body-row--skeleton',
          styles['body-row--skeleton'],
          {
            [styles['body-row--skeleton-odd']]: rowIndex % 2 === 0,
          },
        )}
        aria-rowindex={rowIndex}
      >
        {children}
      </div>
    )
  },
)

BackgroundRow.displayName = 'BackgroundRow'
