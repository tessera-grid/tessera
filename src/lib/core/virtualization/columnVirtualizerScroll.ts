import type { CSSProperties } from 'react'

import type { VirtualItem } from '../../../vendor/tanstack-virtual/react-virtual'

import type { Table } from '../../types'

interface ColumnVirtualizerScrollParams {
  table: Table<any, any>
  virtualColumns: VirtualItem[]
  columnsTotalSize: number
}

/**
 * Горизонтальная виртуализация без layout-thrash: центральные (непиннутые) ячейки
 * позиционируются АБСОЛЮТНО по своему `left` (вне потока) — добавление/удаление ячейки
 * на границе окна не пере-раскладывает соседей и не заставляет чтение scrollLeft
 * форсить reflow. Экстент потока держит ОДИН спейсер постоянной ширины
 * `--virtual-center-width` (сумма всех центральных колонок) между блоками пиннинга —
 * значение не зависит от прокрутки, поэтому не тришит layout.
 * @link https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-columns
 */
export const useColumnVirtualizerScroll = ({
  table,
  virtualColumns,
  columnsTotalSize,
}: ColumnVirtualizerScrollParams) => {
  const startVisibleColumns = table.getStartVisibleLeafColumns()
  const endVisibleColumns = table.getEndVisibleLeafColumns()

  const pinnedWidth = [...startVisibleColumns, ...endVisibleColumns].reduce(
    (sum: number, column: any) => sum + column.getSize(),
    0,
  )
  const centerWidth = columnsTotalSize - pinnedWidth

  return {
    '--virtual-center-width': virtualColumns.length
      ? `${centerWidth}px`
      : undefined,
    // Спейсер — первым в DOM, на экране — за левыми закреплёнными, правые — после него.
    '--tsr-virtual-end-order': virtualColumns.length ? '2' : undefined,
  } as CSSProperties
}
