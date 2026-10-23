import type { CSSProperties } from 'react'

import type { DataGridProps } from './dataGridTypes'

export type GetTableHeightParams = Pick<DataGridProps, 'height' | 'maxHeight'>

/**
 * Предел высоты корня для области прокрутки: у корня без высоты процент её высоты не
 * считается, и без предела область растянулась бы на все строки (ADR 0131, GH4).
 * Процент сюда не идёт — у области он считался бы от корня, а не от контейнера.
 */
const maxHeightVar = (maxHeight: DataGridProps['maxHeight']) => {
  if (typeof maxHeight === 'number') return `${maxHeight}px`
  if (maxHeight === undefined || maxHeight.includes('%')) return undefined
  return maxHeight
}

export const getTableHeight = ({
  height,
  maxHeight,
}: GetTableHeightParams): CSSProperties => {
  const limit = maxHeightVar(maxHeight)
  const vars = (
    limit === undefined ? {} : { '--tsr-comp-grid-max-height': limit }
  ) as CSSProperties

  if (height === 'auto') {
    return {
      ...vars,
      flex: 1,
      minHeight: 0,
      maxHeight,
    }
  }

  return {
    ...vars,
    height,
    maxHeight,
  }
}
