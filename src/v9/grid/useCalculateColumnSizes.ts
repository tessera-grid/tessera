import { useMemo } from 'react'

import type { Table } from '../types'
import { useTableState } from '../core/reactivity'
import { buildColumnSizeVars } from './columnSizes'

export interface CalculateColumnsSizeParams {
  table: Table<any, any>
}

/**
 * CSS-переменные ширин колонок/заголовков (`--header-<id>-size` / `--col-<id>-size`)
 * для performant-ресайза. Пересчитывается при изменении срезов columnSizing/
 * columnResizing (в v9 sizing/resizing разделены; срезов может не быть при
 * выключенном плагине — читаем проекцией через useTableState с ?.).
 * @link https://tanstack.com/table/latest/docs/framework/react/examples/column-resizing-performant
 */
export const useCalculateColumnSizes = ({
  table,
}: CalculateColumnsSizeParams) => {
  const sizingDeps = useTableState(table, state => {
    const s = state as {
      columnSizing?: unknown
      columnResizing?: unknown
    }
    return { columnSizing: s.columnSizing, columnResizing: s.columnResizing }
  })

  return useMemo(
    () => buildColumnSizeVars(table as never),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, sizingDeps.columnSizing, sizingDeps.columnResizing],
  )
}
