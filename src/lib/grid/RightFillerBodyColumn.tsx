import { memo } from 'react'
import clsx from 'clsx'

import styles from './BodyCell/BodyCell.module.css'

export interface RightFillerBodyColumnProps {
  hasBorderTop?: boolean
  hasBorderBottom?: boolean
  hasBorderRight?: boolean
  /** Строка под волной ожидания: заполнитель идёт вместе с её ячейками. */
  wave?: boolean
  /** Место в строке с виртуальными колонками: спейсер центра стоит раньше. */
  order?: number
}

export const RightFillerBodyColumn = memo(
  ({
    hasBorderTop,
    hasBorderBottom,
    hasBorderRight,
    wave,
    order,
  }: RightFillerBodyColumnProps) => {
    return (
      <div
        className={clsx('data-grid__body-filler', styles.body__filler)}
        data-pending-wave={wave || undefined}
        style={{
          flex: 1,
          order,
          borderTop: hasBorderTop
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
          borderBottom: hasBorderBottom
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
          borderRight: hasBorderRight
            ? '1px solid var(--tsr-comp-cell-divider-color)'
            : undefined,
        }}
      />
    )
  },
)

RightFillerBodyColumn.displayName = 'RightFillerBodyColumn'
