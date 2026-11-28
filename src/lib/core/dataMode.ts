/**
 * Режим данных таблицы (ADR 0169): какую операцию над строками выполняет сервер.
 * `dataMode` — договор на время жизни таблицы; серверная модель строк — сервер для всех
 * операций, кроме выгрузки (§2).
 */
import { logWarn } from '../util/logger'
import { serverRowModelReason } from './pluginDiagnostics'

/** Row operations that run on the client or the server. */
export type DataOperation =
  'sorting' | 'filtering' | 'search' | 'pagination' | 'export'

export type DataModeValue = 'client' | 'server'

/** Data mode: one for all operations or per operation; an operation not set runs on the client. */
export type DataMode =
  DataModeValue | Partial<Record<DataOperation, DataModeValue>>

export const DATA_OPERATIONS: readonly DataOperation[] = [
  'sorting',
  'filtering',
  'search',
  'pagination',
  'export',
]

interface ModeTable {
  options: {
    dataMode?: DataMode
    getRowSource?: unknown
    pagedRows?: boolean
    partialData?: boolean
    serverRowCount?: number
    totalRowCount?: number
  }
  store?: { get: () => Record<string, unknown> }
}

const declaredModeOf = (
  dataMode: DataMode | undefined,
  operation: DataOperation,
): DataModeValue =>
  typeof dataMode === 'string' ? dataMode : (dataMode?.[operation] ?? 'client')

const modeOf = (
  dataMode: DataMode | undefined,
  serverRows: boolean,
  operation: DataOperation,
): DataModeValue =>
  serverRows && operation !== 'export'
    ? 'server'
    : declaredModeOf(dataMode, operation)

/** Где выполняется операция над строками таблицы. */
export const dataModeOf = (
  table: unknown,
  operation: DataOperation,
): DataModeValue =>
  modeOf(
    (table as ModeTable).options.dataMode,
    !!serverRowModelReason(table),
    operation,
  )

/**
 * Строки показаны страницами модели пагинации (§6): так их узнают ядро, лента и модель
 * раскрытия.
 */
export const isPaginationActive = (table: unknown) =>
  (table as ModeTable).options.pagedRows === true

/**
 * Опции v9 по режиму (§1): клиентская модель строк не применяет серверных операций.
 * Фильтры колонок и поиск делят одну стоковую модель — её выключает только сервер обеих.
 */
export const manualOptionsOf = (options: ModeTable['options']) => {
  const serverRows = typeof options.getRowSource === 'function'
  const server = (operation: DataOperation) =>
    modeOf(options.dataMode, serverRows, operation) === 'server'
  return {
    manualSorting: server('sorting'),
    manualFiltering: server('filtering') && server('search'),
    // Без включённой модели пагинации стоковая модель страниц строк не режет.
    manualPagination: options.pagedRows !== true || server('pagination'),
  }
}

/** Строк на сервере для текущего запроса (§4): `-1` — неизвестно, `undefined` — не задано. */
export const rowCountOf = (table: unknown): number | undefined =>
  (table as ModeTable).options.serverRowCount

/** Строк на сервере до фильтров и поиска. */
export const totalRowCountOf = (table: unknown): number | undefined =>
  (table as ModeTable).options.totalRowCount

/** Известный итог: неизвестный (`-1`) и не заданный — `undefined`. */
export const knownCount = (count: number | undefined) =>
  count === undefined || count < 0 ? undefined : count

/**
 * Стоковый `rowCount` TanStack (число страниц) — только у страниц с сервера: у клиентской
 * страницы итог — строки в `data` после клиентских операций.
 */
export const stockRowCountOf = (
  options: ModeTable['options'] & {
    rowCount?: number
  },
) =>
  isPaginationActive({ options }) &&
  modeOf(options.dataMode, false, 'pagination') === 'server'
    ? knownCount(options.rowCount)
    : undefined

/** Ключ значения режима: смена ключа после монтирования — нарушение договора. */
export const dataModeKeyOf = (dataMode: DataMode | undefined) =>
  typeof dataMode === 'string'
    ? dataMode
    : DATA_OPERATIONS.map(operation =>
        declaredModeOf(dataMode, operation),
      ).join(',')

/** Операции, которые `dataMode` явно отдаёт клиенту вопреки серверной модели строк (§2). */
const clientInServerRows = (dataMode: DataMode | undefined) =>
  dataMode === undefined
    ? []
    : DATA_OPERATIONS.filter(
        operation =>
          operation !== 'export' &&
          (typeof dataMode === 'string' ? dataMode : dataMode[operation]) ===
            'client',
      )

/** Dev-warn: `dataMode` противоречит серверной модели строк (MD4). */
export const warnDataModeInServerRows = (table: unknown) => {
  if (!serverRowModelReason(table)) return
  const operations = clientInServerRows((table as ModeTable).options.dataMode)
  if (operations.length === 0) return
  logWarn(
    table as never,
    `dataMode: ${operations.join(', ')} on the client has no effect with the server row model — the server handles every operation except export`,
    'dataMode:serverRows',
  )
}

/** Операции, срез которых сужает или переставляет строки, и где он не пуст. */
const CLIENT_SLICES: readonly [
  operation: DataOperation | 'grouping',
  slice: string,
][] = [
  ['sorting', 'sorting'],
  ['filtering', 'columnFilters'],
  ['search', 'globalFilter'],
  ['grouping', 'grouping'],
]

const isEmptySlice = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

/** Почему в `data` только часть строк сервера (§3); `undefined` — строки все. */
export const partialRowsReason = (
  table: unknown,
): 'serverRowModel' | 'serverPage' | 'feed' | undefined => {
  const { options } = table as ModeTable
  if (serverRowModelReason(table)) return 'serverRowModel'
  if (
    isPaginationActive(table) &&
    declaredModeOf(options.dataMode, 'pagination') === 'server'
  ) {
    return 'serverPage'
  }
  return options.partialData ? 'feed' : undefined
}

/**
 * Dev-warn: в `data` только часть строк, а операция с непустым срезом идёт на клиенте —
 * клиент видит только загруженные строки (MD5). Один раз на операцию.
 */
export const warnClientOverPartialRows = (table: unknown) => {
  const reason = partialRowsReason(table)
  if (!reason || reason === 'serverRowModel') return
  const state = (table as ModeTable).store?.get() ?? {}
  for (const [operation, slice] of CLIENT_SLICES) {
    if (isEmptySlice(state[slice])) continue
    if (operation !== 'grouping' && dataModeOf(table, operation) === 'server') {
      continue
    }
    const advice =
      operation === 'grouping'
        ? 'use the server row model'
        : `set dataMode.${operation} to 'server'`
    logWarn(
      table as never,
      `dataMode: client-side ${operation} only sees loaded rows (${reason}); ${advice} or load all rows`,
      `dataMode:partial:${operation}`,
    )
  }
}
