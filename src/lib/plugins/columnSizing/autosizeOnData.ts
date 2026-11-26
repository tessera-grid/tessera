/**
 * Подгонка по содержимому на приходе данных и на каждой новой ссылке `data` (ADR 0217, §2, §3):
 * ширины — в пользовательский срез, без `onColumnResizeEnd`. Плагин помнит, какие ширины
 * поставил сам: следующая подгонка берёт колонку, только если её ширина с тех пор не менялась —
 * протяжку пользователя не перетирает.
 */
import type { ColumnSizingState } from '@tanstack/react-table'

import { reportAction } from '../../core/debugActions'
import { whenViewport } from '../../core/scrollToRow/viewport'
import {
  applyFitted,
  autosizableColumns,
  fittedWidths,
  splitByFlex,
} from './autosize'

interface DataTable {
  store: object
  options: {
    data?: unknown
    autosizeOnData?: boolean
    columnUserSizing?: ColumnSizingState
  }
  setColumnSizing: (
    updater: (old: ColumnSizingState) => ColumnSizingState,
  ) => void
}

interface Memory {
  data: unknown
  widths: Map<string, number>
}

const memory = new WeakMap<object, Memory>()

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

const hasRows = (data: unknown) => Array.isArray(data) && data.length > 0

/** Согласование плагина: новая ссылка `data` с строками — подгонка после отрисовки строк. */
export const reconcileAutosizeOnData = (
  table: unknown,
  { enabled }: { enabled: boolean },
) => {
  const t = table as DataTable
  if (!enabled || t.options.autosizeOnData !== true) return
  const { data } = t.options
  const entry = memory.get(t.store) ?? { data: undefined, widths: new Map() }
  memory.set(t.store, entry)
  if (entry.data === data || !hasRows(data)) return
  entry.data = data
  void (async () => {
    // В продакшене первый рендер может оставаться рамкой дольше двух кадров (ADR 0203).
    if (!(await whenViewport(table))) return
    await frame()
    await frame()
    if (entry.data !== data) return
    const user = t.options.columnUserSizing ?? {}
    const ids = autosizableColumns(table)
      .map(column => column.id)
      .filter(id => user[id] === undefined || user[id] === entry.widths.get(id))
    const widths = await fittedWidths(table, ids)
    if (entry.data !== data || Object.keys(widths).length === 0) return
    const split = splitByFlex(table, widths)
    for (const [id, width] of Object.entries(split.fixed))
      entry.widths.set(id, width)
    applyFitted(table, split)
    reportAction(table, {
      plugin: 'columnSizing',
      action: 'autosize',
      detail: { columnIds: Object.keys(widths) },
      source: 'auto',
    })
  })()
}
