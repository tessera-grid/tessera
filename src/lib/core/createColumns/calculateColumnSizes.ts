import { useMemo } from 'react'

import { Column, Table } from '@tanstack/react-table'

export const getHeaderSizeVariable = (headerId: string) =>
  `--header-${headerId.replace(/\./, '\\.')}-size`
export const getColumnSizeVariable = (columnId: string) =>
  `--col-${columnId.replace(/\./, '\\.')}-size`

/**
 * Sticky-смещение закреплённой ячейки как CSS `calc()` от тех же
 * `--col-<id>-size` переменных, что задают ширины. Значение колонки
 * (`column.getStart`/`getAfter`) запекало бы смещение в пиксели на момент
 * рендера, поэтому ресайз соседней закреплённой колонки не пересчитывал бы его —
 * а `calc()` над реактивными переменными ширины пересчитывается браузером сам
 * (тот же performant-подход, что и у ширин). Слагаемые повторяют выборку
 * `getStart('left')` / `getAfter('right')` из TanStack: сумма размеров видимых
 * закреплённых листьев до / после текущего.
 */
const sumSizeVars = (columns: Column<any>[]) =>
  columns.length === 0
    ? '0px'
    : `calc(${columns.map(column => `var(${getColumnSizeVariable(column.id)})`).join(' + ')})`

export const getPinnedLeftOffset = (table: Table<any>, column: Column<any>) =>
  sumSizeVars(
    table.getLeftVisibleLeafColumns().slice(0, column.getIndex('left')),
  )

export const getPinnedRightOffset = (table: Table<any>, column: Column<any>) =>
  sumSizeVars(
    table.getRightVisibleLeafColumns().slice(column.getIndex('right') + 1),
  )

export interface CalculateColumnsSizeParams {
  table: Table
}

/**
 * Функция вычисления ширины колонок
 * @link https://tanstack.com/table/latest/docs/framework/react/examples/column-resizing-performant
 * @return Объект типа Record<string, string>, где ключ - это уникальная css-переменная с id заголовка или колонки, а значение - число px
 */
export const useCalculateColumnSizes = ({
  table,
}: CalculateColumnsSizeParams) => {
  const headers = table.getFlatHeaders()

  return useMemo(() => {
    const colSizes: Record<string, string> = {}

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]

      const headerSize = header.getSize()
      const columnSize = header.column.getSize()

      colSizes[getHeaderSizeVariable(header.id)] = `${headerSize}px`
      colSizes[getColumnSizeVariable(header.column.id)] = `${columnSize}px`
    }

    return colSizes
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizingInfo,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizing,
    headers,
  ])
}
