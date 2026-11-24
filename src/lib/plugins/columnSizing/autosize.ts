/**
 * Автоподбор ширины по содержимому (ADR 0217): замер грида, пределы колонки, запись как у
 * протяжки — пользовательский срез `columnSizing`, `onColumnResizeEnd` и действие в канале.
 * Подгонка по опции `autosizeOnData` не помечает колонку протянутой (§3).
 */
import type { ColumnSizingState } from '@tanstack/react-table'

import { measureColumns } from './measureColumns'
import { type DebugActionSource, reportAction } from '../../core/debugActions'
import { readPluginHooks } from '../../core/definePlugin'
import { isFlexColumn } from '../../core/flexColumns'
import type { ColumnSizingHooks } from './types'

interface SizedColumn {
  id: string
  columnDef: { minSize?: number; maxSize?: number; flex?: number }
  getSize: () => number
  getIsVisible: () => boolean
  getCanResize?: () => boolean
  getIsActionsColumn?: () => boolean
}

interface AutosizeTable {
  getAllLeafColumns: () => SizedColumn[]
  getColumn: (id: string) => SizedColumn | undefined
  setColumnSizing: (
    updater: (old: ColumnSizingState) => ColumnSizingState,
  ) => void
  setColumnFlexMinSizing: (
    updater: (old: ColumnSizingState) => ColumnSizingState,
  ) => void
  options: { columnUserSizing?: ColumnSizingState }
}

/**
 * Подогнанные ширины по месту записи (ADR 0217, §3): флекс-колонке — нижняя граница по
 * содержимому, флекс остаётся; остальным, и флекс-колонке, протянутой пользователем, — ширина.
 */
export const splitByFlex = (table: unknown, widths: ColumnSizingState) => {
  const t = table as AutosizeTable
  const user = t.options.columnUserSizing ?? {}
  const flex: ColumnSizingState = {}
  const fixed: ColumnSizingState = {}
  for (const [id, width] of Object.entries(widths)) {
    const column = t.getColumn(id)
    if (column && isFlexColumn(column) && user[id] === undefined)
      flex[id] = width
    else fixed[id] = width
  }
  return { flex, fixed }
}

/** Записать подогнанные ширины: границы флекс-колонок и ширины остальных. */
export const applyFitted = (
  table: unknown,
  { flex, fixed }: ReturnType<typeof splitByFlex>,
) => {
  const t = table as AutosizeTable
  if (Object.keys(flex).length)
    t.setColumnFlexMinSizing(old => ({ ...old, ...flex }))
  if (Object.keys(fixed).length)
    t.setColumnSizing(old => ({ ...old, ...fixed }))
}

const isAutosizable = (column: SizedColumn) =>
  column.getIsVisible() &&
  !column.getIsActionsColumn?.() &&
  column.getCanResize?.() !== false

/** Нужен ли пункт подгонки всех колонок в меню. */
export const hasAutosizableColumns = (table: unknown) =>
  (table as AutosizeTable).getAllLeafColumns().some(isAutosizable)

/** Колонки данных, которые можно подогнать: видимые, не служебные. */
export const autosizableColumns = (table: unknown, ids?: readonly string[]) => {
  const t = table as AutosizeTable
  const columns = ids
    ? ids.flatMap(id => t.getColumn(id) ?? [])
    : t.getAllLeafColumns()
  return columns.filter(isAutosizable)
}

const clamp = (column: SizedColumn, width: number) =>
  Math.min(
    Math.max(width, column.columnDef.minSize ?? 0),
    column.columnDef.maxSize ?? Number.POSITIVE_INFINITY,
  )

/** Ширины по замеру в пределах колонок; колонки без ячеек — без записи. */
export const fittedWidths = async (
  table: unknown,
  ids?: readonly string[],
): Promise<ColumnSizingState> => {
  const columns = autosizableColumns(table, ids)
  const measured = await measureColumns(
    table,
    columns.map(column => column.id),
  )
  const widths: ColumnSizingState = {}
  for (const column of columns) {
    const width = measured[column.id]
    if (width !== undefined) widths[column.id] = clamp(column, width)
  }
  return widths
}

/** Подогнать колонки по действию пользователя или API; `true` — подогнано хоть одна. */
export const autosizeColumns = async (
  table: unknown,
  ids: readonly string[] | undefined,
  source: DebugActionSource,
) => {
  const widths = await fittedWidths(table, ids)
  const entries = Object.entries(widths)
  if (entries.length === 0) return false
  const split = splitByFlex(table, widths)
  applyFitted(table, split)
  reportAction(table, {
    plugin: 'columnSizing',
    action: 'autosize',
    detail: { columnIds: entries.map(([id]) => id) },
    source,
  })
  // Колбэк — у колонок, чья ширина стала пользовательской; флекс-колонка делит ширину дальше.
  const { onColumnResizeEnd: onEnd } = readPluginHooks<
    Partial<ColumnSizingHooks>
  >(table as { getHooks: () => unknown }, 'columnSizing')
  for (const [id, width] of Object.entries(split.fixed)) onEnd?.({ id, width })
  return true
}
