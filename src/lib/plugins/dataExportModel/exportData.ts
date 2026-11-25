/**
 * Сбор данных выгрузки из таблицы (ADR 0044, §2–§3): колонки в порядке отображения,
 * строки по охвату пресета, значения ячеек, а не их отрисовка; у колонок с вариантами
 * — подписи (ADR 0048, §4).
 */
import { timeSlicer } from '../../util/timeSlice'
import { isPlaceholderRow } from '../../core/lazyPlaceholder'
import { type ColumnOptionsDef, optionTextOf } from '../../core/columnOptions'
import { objectLabelOf } from '../../core/dataTypeFormat'
import type { ResolvedDataType } from '../../core/dataTypes'
import { announcerLabels } from '../../core/announcer'
import { cancelPending } from '../../core/cancellation'
import { ENGLISH_LABELS } from '../../core/localization'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { dataRowSourceOf, LIST_SLICES, watchSlices } from '../../core/rowSource'
import {
  rowSelectionValueOf,
  tableAllSelection,
} from '../../core/rowSelectionAll'
import {
  serverAggregationScopesOf,
  serverAggregationsOf,
} from '../../shared/serverAggregations'
import { dataExportModelLabels } from './labels'
import type {
  ExportColumn,
  ExportData,
  ExportRequest,
  ExportRows,
  ExportValueContext,
} from './types'
import { rowsOf } from '../../core/rowEngine/rows'

export interface ExportCollectOptions {
  rows?: ExportRows
  columns?: 'visible' | 'all'
  formatValue?: (context: ExportValueContext) => unknown
}

interface ExportRow {
  id: string
  getValue: (columnId: string) => unknown
  getIsGrouped?: () => boolean
  getIsSelected?: () => boolean
  subRows?: ExportRow[]
}

interface ExportSourceColumn {
  id: string
  columnDef: { header?: unknown } & ColumnOptionsDef
  getDataType?: () => ResolvedDataType | undefined
  getIsVisible: () => boolean
  getSize?: () => number
  getIsActionsColumn?: () => boolean
  getIsPinned?: () => false | 'start' | 'end'
}

interface ExportTable {
  getAllLeafColumns: () => ExportSourceColumn[]
  options?: { timeZone?: string }
}

const PIN_ORDER = { start: 0, center: 1, end: 2 } as const

/** Значение → текст: null → пусто, Date → ISO, объект → JSON. */
export const toExportText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const exportColumnsOf = (
  table: unknown,
  scope: 'visible' | 'all' = 'visible',
): ExportSourceColumn[] =>
  (table as ExportTable)
    .getAllLeafColumns()
    .filter(
      column =>
        !column.getIsActionsColumn?.() &&
        (scope === 'all' || column.getIsVisible()),
    )
    .map((column, index) => ({
      column,
      index,
      side: PIN_ORDER[column.getIsPinned?.() || 'center'],
    }))
    .sort((a, b) => a.side - b.side || a.index - b.index)
    .map(({ column }) => column)

export const headerOf = (column: ExportSourceColumn): string =>
  typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id

/** Строка страницы — данные: без строк-групп и скелетов ленивых детей. */
const isPageRow = (row: ExportRow) =>
  !row.getIsGrouped?.() && !isPlaceholderRow(row)

/** Данные в глубину по `subRows`; строки-группы пропускаются, их дети — нет. */
const walk = (
  rows: readonly ExportRow[],
  visit: (row: ExportRow) => void,
  children: (row: ExportRow) => readonly ExportRow[] = row => row.subRows ?? [],
) => {
  for (const row of rows) {
    // Скелет-строка ленивых детей — не данные (ADR 0155, §3).
    if (isPlaceholderRow(row)) continue
    if (!row.getIsGrouped?.()) visit(row)
    const kids = children(row)
    if (kids.length) walk(kids, visit, children)
  }
}

export const exportRowsOf = (
  table: unknown,
  scope: ExportRows,
): ExportRow[] => {
  const out: ExportRow[] = []
  const push = (row: ExportRow) => out.push(row)

  if (scope === 'all') {
    walk(rowsOf<ExportRow>(table, 'core').rows, push)
  } else if (scope === 'page') {
    // Строки страницы уже плоские (раскрытые дети — отдельные строки): без обхода.
    // Строки до сохранения не выгружаются: только данные (ADR 0178, DR34).
    const rows = dataRowSourceOf<ExportRow>(table)
    for (let index = 0; index < rows.count(); index++) {
      const row = rows.at(index)
      if (row && isPageRow(row)) push(row)
    }
  } else {
    // Строки до раскрытия и нарезки: после сортировки и группировки, все страницы.
    const view = rowsOf<ExportRow>(table, 'sorted')
    walk(
      view.rows,
      row => {
        if (scope === 'view' || row.getIsSelected?.()) push(row)
      },
      view.children,
    )
    // Выбранные, но скрытые фильтром — после видимых, в порядке данных (ADR 0045, FL25).
    if (scope === 'selected') {
      const included = new Set(out.map(row => row.id))
      walk(rowsOf<ExportRow>(table, 'core').rows, row => {
        if (row.getIsSelected?.() && !included.has(row.id)) push(row)
      })
    }
  }
  return out
}

/**
 * Загрузка строк страницы серверной модели, если часть их не пришла (ADR 0158, SP12);
 * `undefined` — страница уже у грида целиком.
 */
export const pageRowsLoaderOf = (table: unknown, scope: ExportRows) => {
  if (scope !== 'page') return undefined
  const source = dataRowSourceOf<ExportRow>(table)
  if (!source.loadRange) return undefined
  const count = source.count()
  for (let index = 0; index < count; index++) {
    if (source.at(index)) continue
    return async (signal: AbortSignal) => {
      const rows = await source.loadRange!(0, count - 1, signal)
      return rows.filter((row): row is ExportRow => !!row && isPageRow(row))
    }
  }
  return undefined
}

export const DEFAULT_MAX_LOADED_ROWS = 10_000

interface ExportLimitTable {
  options: { exportOptions?: { maxLoadedRows?: number } }
}

/**
 * Загрузка всей выборки серверной модели (ADR 0190): `view` без серверной выгрузки. Строк
 * больше предела — отказ с причиной, неполного файла нет.
 */
export const listRowsLoaderOf = (table: unknown, scope: ExportRows) => {
  if (scope !== 'view') return undefined
  const source = dataRowSourceOf<ExportRow>(table)
  if (!source.loadList) return undefined
  const { exportOptions } = (table as ExportLimitTable).options
  const max = exportOptions?.maxLoadedRows ?? DEFAULT_MAX_LOADED_ROWS
  return async (signal: AbortSignal) => {
    // Смена выборки: строки уже не те, файл не нужен (ADR 0190, §3).
    const unwatch = watchSlices(table, LIST_SLICES, () =>
      cancelPending(table, { kind: 'export' }, 'api'),
    )
    const rows = await source.loadList!(max, signal).finally(unwatch)
    if (!rows) {
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      throw new Error(dataExportModelLabels(labels).exportTooManyRows(max))
    }
    return rows.filter(isPageRow)
  }
}

/** Id выбранных строк из среза `rowSelection` — по всем страницам, в том числе не загруженным. */
/**
 * Серверная модель строк (ADR 0138, §10): серверу нужна выборка и срез выбора, строк у
 * грида нет. Без неё — срез «всё, кроме» страницы с сервера и ленты (ADR 0179, §3), иначе
 * пусто.
 */
export const serverRowsRequestOf = (
  table: unknown,
): Pick<ExportRequest, 'query' | 'selection'> => {
  if (!serverRowModelReason(table)) {
    const all = tableAllSelection(table)
    return all ? { selection: all } : {}
  }
  const state = (
    table as { store: { get: () => Record<string, unknown> } }
  ).store.get()
  return {
    query: {
      sorting: (state.sorting ?? []) as unknown[],
      columnFilters: (state.columnFilters ?? []) as unknown[],
      globalFilter: (state.globalFilter ?? '') as string,
      grouping: (state.grouping ?? []) as string[],
      aggregations: serverAggregationsOf(table),
      aggregationScopes: serverAggregationScopesOf(table),
    },
    selection: rowSelectionValueOf(table),
  }
}

export const selectedRowIdsOf = (table: unknown): string[] => {
  const selection = (
    table as {
      atoms?: { rowSelection?: { get: () => Record<string, boolean> } }
    }
  ).atoms?.rowSelection?.get()
  return Object.entries(selection ?? {})
    .filter(([, selected]) => selected)
    .map(([id]) => id)
}

const dataTypeOf = (
  column: ExportSourceColumn,
): Pick<ExportColumn, 'dataType'> => {
  const type = column.getDataType?.()
  if (!type) return {}
  const { parseDate } = type.definition
  return {
    dataType: {
      name: type.name,
      base: type.base,
      ...(parseDate && { parseDate }),
    },
  }
}

const prepareExportCollection = (
  table: unknown,
  { rows = 'all', columns = 'visible', formatValue }: ExportCollectOptions = {},
  /** Уже загруженные строки вместо строк охвата `rows`. */
  loaded?: readonly ExportRow[],
) => {
  const leaves = exportColumnsOf(table, columns)
  const exportColumns: ExportColumn[] = leaves.map(column => ({
    id: column.id,
    header: headerOf(column),
    size: column.getSize?.(),
    pinned: column.getIsPinned?.() ?? false,
    ...dataTypeOf(column),
  }))
  const timeZone = (table as ExportTable).options?.timeZone
  const valuesOf = (row: ExportRow) =>
    leaves.map(column => {
      const value = row.getValue(column.id)
      if (formatValue) return formatValue({ value, row, column })
      // Запись object выгружается подписью (ADR 0174, TY7).
      const type = column.getDataType?.()
      if (type?.base === 'object') return objectLabelOf(type.definition, value)
      return optionTextOf(table as object, column, value) ?? value
    })
  return {
    header: { columns: exportColumns, ...(timeZone ? { timeZone } : {}) },
    rows: loaded ?? exportRowsOf(table, rows),
    valuesOf,
  }
}

export const collectExportData = (
  table: unknown,
  options: ExportCollectOptions = {},
  loaded?: readonly ExportRow[],
): ExportData => {
  const { header, rows, valuesOf } = prepareExportCollection(
    table,
    options,
    loaded,
  )
  return { ...header, rows: rows.map(valuesOf) }
}

export const collectExportDataInChunks = async (
  table: unknown,
  options: ExportCollectOptions,
  loaded: readonly ExportRow[] | undefined,
  signal: AbortSignal,
): Promise<ExportData> => {
  const { header, rows, valuesOf } = prepareExportCollection(
    table,
    options,
    loaded,
  )
  const values: ExportData['rows'] = []
  const slice = timeSlicer()
  for (let offset = 0; offset < rows.length; offset += 2000) {
    signal.throwIfAborted()
    values.push(...rows.slice(offset, offset + 2000).map(valuesOf))
    await slice()
  }
  signal.throwIfAborted()
  return { ...header, rows: values }
}
