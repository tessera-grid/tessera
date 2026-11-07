/**
 * Приложение историй клиентских транзакций (ADR 0194): таблица, которой оно передаёт
 * транзакции, и поток изменений для `Playground`. Данные — у истории: следующий `data`
 * приходит в её `onDataChange`.
 */
import type { TesseraFeatureEntry } from '../../core/features'
import type {
  RowTransaction,
  RowTransactionResult,
} from '../../core/rowTransactions'

interface Row {
  id: string
  firstName?: string
  visits?: number
  [key: string]: unknown
}

interface TransactionTable {
  store: unknown
  options: { data: Row[] }
  applyRowTransaction: (
    transaction: RowTransaction<Row>,
  ) => RowTransactionResult
}

/** Таблица, открытая историей, и номер следующей новой строки. */
export const clientTx = {
  store: undefined as unknown,
  table: undefined as TransactionTable | undefined,
  created: 0,
  /** Итог последней транзакции. */
  result: undefined as RowTransactionResult | undefined,
}

/** Таблица истории; новое открытие таблицы — нумерация новых строк заново. */
export const clientTxSeed: TesseraFeatureEntry = {
  id: 'clientTransactionsGuide',
  setup: table => {
    const t = table as TransactionTable
    clientTx.table = t
    if (clientTx.store === t.store) return
    clientTx.store = t.store
    clientTx.created = 0
    clientTx.result = undefined
  },
}

/** Новая строка приложения: копия первой строки данных со своим `id` и именем. */
export const newRow = (): Row => {
  const n = ++clientTx.created
  const template = clientTx.table?.options.data[0] ?? { id: '' }
  return { ...template, id: `item-new-${n}`, firstName: `New ${n}` }
}

/** Приложение передаёт таблице транзакцию. */
export const transact = (transaction: RowTransaction<Row>) => {
  clientTx.result = clientTx.table?.applyRowTransaction(transaction)
  return clientTx.result
}

/** Строка по `id` в теле таблицы. */
export const rowById = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)

/** Место строки в списке по `data-index`; нет строки — `-1`. */
export const indexOfRow = (root: ParentNode, id: string) =>
  Number(rowById(root, id)?.dataset.index ?? -1)

/** `id` строки на месте `index`. */
export const rowIdAt = (root: ParentNode, index: number) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-index="${index}"]`)
    ?.dataset.rowId

/**
 * Такт потока: новая строка встаёт второй, у первой растёт число визитов, строка двухтактной
 * давности уходит — одной транзакцией.
 */
export const liveTick = (tick: number) => {
  const data = clientTx.table?.options.data
  if (!data?.length) return
  const first = data[0]!
  transact({
    add: [newRow()],
    index: 1,
    update: [{ ...first, visits: (first.visits ?? 0) + 1 }],
    remove: tick > 2 ? [`item-new-${clientTx.created - 2}`] : [],
  })
}

const streams = new Map<number, TesseraFeatureEntry>()

/** Поток изменений приложения на время жизни таблицы; одна запись на период. */
export const liveStream = (intervalMs: number): TesseraFeatureEntry => {
  let entry = streams.get(intervalMs)
  if (!entry) {
    entry = {
      id: 'clientTransactionsLive',
      setup: () => {
        let tick = 0
        const timer = setInterval(() => liveTick(++tick), intervalMs)
        return () => clearInterval(timer)
      },
    }
    streams.set(intervalMs, entry)
  }
  return entry
}
