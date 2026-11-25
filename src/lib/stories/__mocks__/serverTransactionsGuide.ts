/**
 * «Сервер» историй транзакций строк (ADR 0157): изменяемый набор строк — следующие блоки
 * приходят уже с правками — и таблица, которой приложение передаёт транзакции.
 */
import type { TesseraFeatureEntry } from '../../core/features'
import type {
  ServerRowTransaction,
  ServerRowTransactionResult,
  ServerRowsRequest,
  ServerRowsResponse,
} from '../../plugins'
import type { DemoStoryStep } from '../demos/DemoStory'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './filteringData'

export const TX_TOTAL = 1000
export const TX_BLOCK = 50
/** Вложенных строк у строки верхнего уровня. */
export const TX_CHILDREN = 3
const TX_DELAY_MS = 400

interface TransactionTable {
  store: unknown
  applyRowTransaction: (
    transaction: ServerRowTransaction<FilteringItem>,
  ) => ServerRowTransactionResult | undefined
}

/** Набор «сервера», запросы к нему и таблица, открытая на нём. */
export const txServer = {
  store: undefined as unknown,
  table: undefined as TransactionTable | undefined,
  items: [] as FilteringItem[],
  /** Вложенные строки по родителю: заводятся при первом запросе ветки. */
  children: new Map<string, FilteringItem[]>(),
  /** Номер следующей новой записи. */
  created: 0,
  requests: 0,
  hold: false,
  held: [] as (() => void)[],
}

/** Отдать ответы, которые «сервер» держал. */
export const txRelease = () => {
  const held = txServer.held
  txServer.held = []
  for (const answer of held) answer()
}

/** Новая запись «сервера»: свой `id`, имя с номером. */
export const newItem = (): FilteringItem => {
  const n = ++txServer.created
  return { ...filteringItemAt(n * 7), id: `item-new-${n}`, name: `New ${n}` }
}

/** Приложение передаёт таблице транзакцию — то, что сервер уже применил. */
export const transact = (transaction: ServerRowTransaction<FilteringItem>) =>
  txServer.table?.applyRowTransaction(transaction)

/** Новое открытие таблицы — новый набор: прежние правки ей не принадлежат. */
const txReset: TesseraFeatureEntry = {
  id: 'serverTransactionsGuide',
  setup: table => {
    const store = (table as TransactionTable).store
    txServer.table = table as TransactionTable
    if (txServer.store === store) return
    txServer.store = store
    txServer.items = Array.from({ length: TX_TOTAL }, (_, i) =>
      filteringItemAt(i),
    )
    txServer.children = new Map()
    txServer.created = 0
    txServer.requests = 0
    txServer.hold = false
    txRelease()
  },
}

/** Вложенные строки родителя на «сервере». */
export const childrenOf = (parentId: string) => {
  let rows = txServer.children.get(parentId)
  if (!rows) {
    const first = TX_TOTAL + Number(parentId.split('-').at(-1)) * 100
    rows = Array.from({ length: TX_CHILDREN }, (_, k) => ({
      ...filteringItemAt(first + k),
      id: `${parentId}.${k}`,
    }))
    txServer.children.set(parentId, rows)
  }
  return rows
}

/**
 * Пропсы грида на «сервере» транзакций; ответ читает набор в момент ответа. `tree` — у
 * строк верхнего уровня есть вложенные.
 */
export const txProps =
  (
    extraPlugins: TesseraFeatureEntry[] = [],
    tree = false,
  ): DemoStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: TX_BLOCK,
    rowCount: TX_TOTAL,
    ...(tree && {
      enableRowExpanding: true,
      rowExpandingHasChildren: (row: { depth: number }) => row.depth === 0,
      // Линии дерева у веток серверной модели (ADR 0161).
      enableTreeLines: true,
    }),
    serverRowModelGetRows: ({
      start,
      end,
      parentId,
      signal,
    }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>(resolve => {
        txServer.requests++
        const answer = () => {
          if (signal.aborted) return
          const rows = parentId ? childrenOf(parentId) : txServer.items
          resolve({ rows: rows.slice(start, end), rowCount: rows.length })
        }
        if (txServer.hold) txServer.held.push(answer)
        else setTimeout(answer, TX_DELAY_MS)
      }),
    extraPlugins: [txReset, ...extraPlugins],
  })

/** Строка по `id` в теле таблицы. */
export const rowById = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)

/** Место строки в списке по `data-index`; нет строки — `-1`. */
export const indexOfRow = (root: ParentNode, id: string) =>
  Number(rowById(root, id)?.dataset.index ?? -1)

/** Пауза действия шага, прерываемая уходом с шага. */
export const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

// --- Поток изменений (S3, `Playground`) ----------------------------------------------

/**
 * Такт потока: новая запись встаёт второй, у первой строки растёт число визитов, запись
 * двухтактной давности уходит, — каждое изменение отдельной транзакцией.
 */
export const liveTick = (tick: number) => {
  const { items } = txServer
  const added = newItem()
  items.splice(1, 0, added)
  transact({ add: [added], index: 1 })
  items[0] = { ...items[0]!, visits: items[0]!.visits + 1 }
  transact({ update: [items[0]] })
  if (tick > 2) {
    const id = `item-new-${txServer.created - 2}`
    const at = items.findIndex(item => item.id === id)
    if (at !== -1) {
      items.splice(at, 1)
      transact({ remove: [id] })
    }
  }
}

const streams = new Map<number, TesseraFeatureEntry>()

/** Поток изменений «сервера» на время жизни таблицы; одна запись на период. */
export const liveStream = (intervalMs: number): TesseraFeatureEntry => {
  let entry = streams.get(intervalMs)
  if (!entry) {
    entry = {
      id: 'serverTransactionsLive',
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
