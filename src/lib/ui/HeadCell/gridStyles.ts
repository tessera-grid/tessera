import { useMemo } from 'react'

import { Header } from '@tanstack/react-table'

export const useGridStyles = (header: Header) => {
  const rowSpan = header.column.columnDef?.rowSpan

  let gridRow: string | number = header.column.depth + 1
  const gridColumn = `span ${header.colSpan}`

  if (typeof rowSpan === 'number' && rowSpan > 0) {
    gridRow = `1 / span ${rowSpan}`
  }

  return useMemo(() => ({ gridRow, gridColumn }), [gridColumn, gridRow])
}
