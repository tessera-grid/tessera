/**
 * Транзакция строк (ADR 0157, ADR 0194, §4): форма у клиентской и серверной модели одна.
 * С серверным источником её применяет он; в клиентском режиме ядро строит следующий `data`
 * — прежние объекты нетронутых строк, новые у изменённых и вставленных — и отдаёт его
 * приложению в `onDataChange`. Источник правды — `data` приложения.
 */
import { logWarn } from '../util/logger'
import { reportAction } from './debugActions'

export interface RowTransaction<TData = any> {
  /** Новые строки; без `index` — в конец уровня (на сервере — перезапрос окна). */
  add?: TData[]
  /** Место первой новой строки на уровне. */
  index?: number
  /** Строки с новыми данными — по их id. */
  update?: TData[]
  /** id удаляемых строк. */
  remove?: string[]
  /** Ветка, в которой меняются строки; нет — корни. */
  parentId?: string
  /** Итог ветки после транзакции, если его знает приложение; клиенту не нужен. */
  rowCount?: number
}

/**
 * Итог транзакции: применена, окно перезапрошено (сервер), ветки нет, или применить
 * нельзя — в клиентском режиме без `onDataChange`.
 */
export type RowTransactionResult =
  'applied' | 'refetch' | 'branchNotLoaded' | 'unavailable'

/** Дети строки по умолчанию — поле `subRows` (`useCreateTable`); транзакция в ветке пишет его. */
export const defaultGetSubRows = <TData>(row: TData) =>
  (row as { subRows?: TData[] }).subRows || []

interface TransactionRow {
  id: string
  index: number
  original: unknown
  parentId?: string
}

interface TransactionTable {
  options: {
    data: unknown[]
    getSubRows?: unknown
    onDataChange?: (data: unknown[], transaction: RowTransaction) => void
  }
  getRowId: (row: unknown, index: number, parent?: unknown) => string
  getCoreRowModel: () => { rowsById: Record<string, TransactionRow> }
  getRowSource: () => {
    applyRowTransaction?: (transaction: RowTransaction) => RowTransactionResult
  }
}

/** Уровень после транзакции: обновление, удаление, затем вставка. */
const applyToLevel = (
  t: TransactionTable,
  level: readonly unknown[],
  transaction: RowTransaction,
  parent: TransactionRow | undefined,
): unknown[] => {
  const idOf = (row: unknown, index: number) => t.getRowId(row, index, parent)
  let next = level.slice()
  if (transaction.update?.length) {
    const updates = new Map<string, unknown>()
    for (const row of transaction.update) updates.set(idOf(row, 0), row)
    next = next.map((row, i) => updates.get(idOf(row, i)) ?? row)
  }
  if (transaction.remove?.length) {
    const removed = new Set(transaction.remove)
    next = next.filter((row, i) => !removed.has(idOf(row, i)))
  }
  if (transaction.add?.length) {
    const at = Math.max(
      0,
      Math.min(transaction.index ?? next.length, next.length),
    )
    next.splice(at, 0, ...transaction.add)
  }
  return next
}

/** Следующий `data` клиента или `undefined`, если ветки нет либо в неё не записать. */
const nextDataOf = (
  t: TransactionTable,
  transaction: RowTransaction,
): unknown[] | 'branchNotLoaded' | 'unwritable' => {
  const data = t.options.data
  if (transaction.parentId === undefined) {
    return applyToLevel(t, data, transaction, undefined)
  }
  // Дети ветки пишутся в поле `subRows` новых объектов её и предков.
  if (t.options.getSubRows !== defaultGetSubRows) return 'unwritable'
  const { rowsById } = t.getCoreRowModel()
  const parent = rowsById[transaction.parentId]
  if (!parent) return 'branchNotLoaded'
  const path: TransactionRow[] = []
  for (
    let row: TransactionRow | undefined = parent;
    row;
    row = row.parentId === undefined ? undefined : rowsById[row.parentId]
  ) {
    path.unshift(row)
  }
  const children = defaultGetSubRows(parent.original)
  let replaced: unknown = {
    ...(parent.original as object),
    subRows: applyToLevel(t, children, transaction, parent),
  }
  for (let depth = path.length - 1; depth >= 0; depth--) {
    const row = path[depth]!
    const level =
      depth === 0 ? data : defaultGetSubRows(path[depth - 1]!.original)
    const next = level.slice()
    next[row.index] = replaced
    if (depth === 0) return next
    replaced = { ...(path[depth - 1]!.original as object), subRows: next }
  }
  return data
}

export const applyRowTransaction = (
  table: unknown,
  transaction: RowTransaction,
): RowTransactionResult => {
  const t = table as TransactionTable
  const server = t.getRowSource().applyRowTransaction
  if (server) return server(transaction)
  reportAction(table, {
    plugin: 'core',
    action: 'rowTransaction',
    detail: {
      add: transaction.add?.length ?? 0,
      update: transaction.update?.length ?? 0,
      remove: transaction.remove?.length ?? 0,
    },
    source: 'api',
  })
  const onDataChange = t.options.onDataChange
  if (!onDataChange) {
    logWarn(
      table as never,
      'applyRowTransaction in the client row model needs onDataChange: the app keeps data',
      'core:clientTransaction',
    )
    return 'unavailable'
  }
  const next = nextDataOf(t, transaction)
  if (next === 'branchNotLoaded') return next
  if (next === 'unwritable') {
    logWarn(
      table as never,
      'applyRowTransaction with parentId needs the default subRows field for children',
      'core:clientTransactionBranch',
    )
    return 'unavailable'
  }
  onDataChange(next, transaction)
  return 'applied'
}
