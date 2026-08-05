import { useMemo } from 'react'

import { Table } from '@tanstack/react-table'

export const getHeaderSizeVariable = (headerId: string) =>
  `--header-${headerId.replace(/\./, '\\.')}-size`
export const getColumnSizeVariable = (columnId: string) =>
  `--col-${columnId.replace(/\./, '\\.')}-size`

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
