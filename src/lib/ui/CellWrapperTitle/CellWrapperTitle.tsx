import { PropsWithChildren, memo } from 'react'

import clsx from 'clsx'

import styles from './CellWrapperTitle.module.css'

/**
 * @description
 * Компонент-обертка над содержимым ячейки.
 */
export const CellWrapperTitle = memo(({ children }: PropsWithChildren) => {
  if (!children) {
    return null
  }

  return (
    <div
      className={clsx('data-grid__cell-wrapper-title', styles.cell__title)}
      data-testid="table-field-cell-name"
    >
      {children}
    </div>
  )
})

CellWrapperTitle.displayName = 'CellWrapperTitle'
