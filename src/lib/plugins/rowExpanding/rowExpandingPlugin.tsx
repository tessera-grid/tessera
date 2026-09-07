import { logWarn } from '../../core/logger'
import { TablePlugin } from '../types'
import { RowExpandingComponent } from './RowExpandingComponent'
import { COLUMN_EXPANDING_ID } from './rowExpandingColumn'

export const DEFAULT_MAX_EXPANDING_DEPTH = 1

export const rowExpandingPlugin: TablePlugin = {
  createRow: (_staticRow, table) => {
    const originalGetCanExpand = _staticRow.getCanExpand

    _staticRow.getCanExpand = () => {
      const enableRowExpanding =
        typeof table.options.enableRowExpanding === 'function'
          ? table.options.enableRowExpanding(_staticRow)
          : !!table.options.enableRowExpanding

      if (table.options.enableGrouping) {
        if (enableRowExpanding) {
          logWarn(
            table,
            'rowExpanding: при включённой группировке (enableGrouping) раскрытием владеет rowGrouping, а настройки rowExpanding (maxExpandingDepth, enableRowExpanding) игнорируются. См. ADR 0022.',
            'rowExpanding:grouping',
          )
        }
        return originalGetCanExpand()
      }

      // maxExpandingDepth — ЧИСЛО раскрываемых уровней от корня, не индекс
      // глубины: раскрываемы уровни 0..maxExpandingDepth-1, поэтому строгое `<`.
      // Дефолт 1 → только корни (depth 0).
      const accessDepth = _staticRow.depth < table.options.maxExpandingDepth

      return enableRowExpanding && accessDepth
    }
  },
  createCell: cell => {
    if (cell.column.id !== COLUMN_EXPANDING_ID) return

    cell.renderComponent = RowExpandingComponent
  },
}
