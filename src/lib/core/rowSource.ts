import type { Row, Table } from '../types'
import { engineOf } from './rowEngine/engine'
import { positionOf } from './rowPosition'
/**
 * Источник строк (ADR 0138, §2): строки, которые рисует тело, — по индексу и по id.
 * Клиентский режим — модель строк TanStack; серверная модель строк подставит свой.
 */

/** Префикс id строки-группы серверной группировки: за ним — JSON пути групп (ADR 0144). */
export const GROUP_ROW_PREFIX = 'group:'

/** Путь значений групп по id строки-группы; у прочих строк — пусто. */
export const groupKeysOf = (id: string | undefined): unknown[] =>
  id?.startsWith(GROUP_ROW_PREFIX)
    ? (JSON.parse(id.slice(GROUP_ROW_PREFIX.length)) as unknown[])
    : []

/** Body rows: by index in the list and by id. */
export interface RowSource<TRow = unknown> {
  /** Rows in the list, including those not loaded yet. */
  count: () => number
  /** Row at an index in the list; `undefined` — none, or not loaded yet. */
  at: (index: number) => TRow | undefined
  /**
   * Virtualizer key of a row — its index, not its id: the virtualizer asks for the keys of all
   * rows on every count change, and the measured height stays with the place in the list
   * (ADR 0138, §14).
   */
  keyByIndex?: boolean
  /** Data row by id, including one not shown in the list (collapsed, on another page). */
  byId: (id: string) => TRow | undefined
  /** Index of a row in the list; `-1` — it's not in the list. */
  indexOf: (id: string) => number
  /** Data rows the grid has, including outside the list: another page, a collapsed branch. */
  loadedRows: () => Iterable<TRow>
  /** The branch of an expanded row is waiting for the source's first answer (ADR 0155, §3). */
  branchLoading?: (id: string) => boolean
  /** Cancels loading a branch: the user cancelled the expand. */
  cancelBranch?: (id: string) => void
  /**
   * Calls `done` on the first answer for a branch the user expanded; a cached branch, a failure,
   * a request cancelled by the window or by collapsing, or a new result set — no call
   * (ADR 0138, SD55–SD60).
   */
  whenBranchArrives?: (
    id: string,
    done: (arrival: BranchArrival) => void,
  ) => void
  /**
   * The whole list as an array, when it is fully loaded (client mode). Without it, the tree,
   * lines, row motion and the drop position in the body are not computed.
   */
  rows?: () => readonly TRow[]
  /** Body row window with overscan, and fast scrolling (ADR 0008): the source loads by them. */
  observe?: (window: RowWindow) => void
  /** Failed parts of the list: the body renders an error row with retry in their place. */
  failures?: () => readonly RowFailure[]
  /**
   * Failure when nothing is loaded: the error stub replaces the body (ADR 0096). The same object
   * while the failure is the same.
   */
  loadError?: () => RowLoadError | undefined
  /**
   * Sorting, filters, search or aggregates changed: the list starts over (ADR 0138, §6); `true`
   * means a new result set started.
   */
  sync?: () => boolean
  /**
   * Window rows for the current result set arrived; a failure carries the block's reason. A
   * server action's promise instead of the application's answer (ADR 0116).
   */
  whenLoaded?: () => PromiseLike<void>
  /** The new result set's window is still loading: previous rows stay under the refresh glow (ADR 0094). */
  refreshing?: () => boolean
  /** Total for `aria-rowcount`, `-1` — unknown; takes precedence over the `getTotalRowCount` option. */
  total?: () => number
  /**
   * Tree `aria-*` of a row by index: level, position among siblings and their count — for rows
   * not in the `rows` array (server row model, ADR 0138, §14).
   */
  treeAria?: (index: number) =>
    | {
        level: number
        posInSet: number
        /** An estimate from loaded rows when the total is unknown: lines, moves and nesting read it. */
        setSize: number
        /** The set's total is known; otherwise the row has `aria-setsize="-1"` (ADR 0226, §3). */
        sizeKnown?: boolean
      }
    | undefined
  /** `id`s of a tree row's ancestors from the root (server row model, ADR 0162). */
  ancestors?: (id: string) => readonly string[]
  /**
   * Rows in a branch at all levels, at the root (`undefined`) — in the whole tree; unknown —
   * `undefined` (server row model, ADR 0162).
   */
  subtreeSize?: (parentId: string | undefined) => number | undefined
  /**
   * Tree lines of a row by index — from the layout, without walking rows (server row model,
   * ADR 0161).
   */
  treeLines?: (
    index: number,
  ) => { depth: number; branch: string; open: boolean } | undefined
  /** Top-level rows: "Select all" in a tree totals them. */
  rootCount?: () => number
  /** The top-level row total is known; without it the pager shows "of many" (ADR 0158, §4). */
  rootCountKnown?: () => boolean
  /**
   * Running index of the source's first row: the source is a page of the list (ADR 0158), its
   * indexes start from the page start.
   */
  offset?: () => number
  /** Indexes of top-level rows of the current page, from its start (ADR 0188). */
  pageRootIndexes?: () => number[]
  /** The page holding the row with a running index; `undefined` — no such row. */
  pageOf?: (listIndex: number) => number | undefined
  /** Running index of a row, including on another page; `-1` — it's not in the list. */
  listIndexOf?: (id: string) => number
  /**
   * Rows in branch `parentId` (without it — roots) and whether its total is known; a branch
   * that isn't expanded gives `undefined` (ADR 0159, §4).
   */
  branchSize?: (
    parentId: string | undefined,
  ) => { count: number; known: boolean } | undefined
  /** The loaded row at `index` of branch `parentId` (without it — roots); none — `undefined`. */
  rowIn?: (parentId: string | undefined, index: number) => TRow | undefined
  /**
   * Moves a row to `index` in branch `parentId` (without it — among roots) right away, without a
   * request (ADR 0159, §2, §4). A row not in the cache is placed from `stray.original` and its
   * place `stray.from` closes; without them — `false`. A branch not loaded — `false`.
   */
  moveRow?: (
    id: string,
    place: { parentId?: string; index: number },
    stray?: {
      original: unknown
      from: { parentId?: string; index: number }
    },
  ) => boolean
  /** Rows in a group by its group row (server grouping, ADR 0144); otherwise none. */
  groupChildCount?(row: TRow): number | undefined
  /** Data rows in a group — for its label (ADR 0184, §8); unknown — `undefined`. */
  groupRowCount?(row: TRow): number | undefined
  /** Column totals of the result set — from the server response (ADR 0144, §4). */
  totals?: () => Record<string, unknown> | undefined
  /** Data rows in the result set with server grouping (ADR 0144, §5). */
  leafCount?: () => number | undefined
  /** Result set number: grows with new sorting, filters, search and cache reset. */
  epoch?: () => number
  /** List layout number: grows with each change of rows by index. */
  version?: () => number
  /**
   * List changes after layout `version`, each in the indexes of the layout before it;
   * `undefined` — the log doesn't remember it (ADR 0146, §6).
   */
  changesSince?: (version: number) => readonly RowListChange[][] | undefined
  /** Rows `[first, last]`: loaded ones right away, others by a request bypassing the window cache. */
  loadRange?: (
    first: number,
    last: number,
    signal: AbortSignal,
  ) => Promise<readonly (TRow | undefined)[]>
  /**
   * All rows of the list on all pages: loaded ones and the rest by a request bypassing the cache
   * (ADR 0190). More rows than `limit` — `undefined`: a known total is checked before requests.
   */
  loadList?: (
    limit: number,
    signal: AbortSignal,
  ) => Promise<readonly TRow[] | undefined>
  /** The source under the layer of rows before saving (ADR 0178, §7): data rows without new ones. */
  base?: RowSource<TRow>
  /** New rows of the layer and their places in the list; the change log doesn't know them (ADR 0178, DR50). */
  newRows?: () => readonly NewRowPlace[]
}

/** Срезы, смена которых начинает новую выборку серверной модели (ADR 0138, §6). */
export const LIST_SLICES = [
  'sorting',
  'columnFilters',
  'globalFilter',
  'grouping',
] as const

interface WatchedAtom {
  get: () => unknown
  subscribe: (listener: () => void) => { unsubscribe: () => void }
}

/**
 * Позвать `changed`, когда значение срезов сменилось: производные атомы оповещают и о новом
 * объекте с тем же значением. Возвращает снятие подписки.
 */
export const watchSlices = (
  table: unknown,
  slices: readonly string[],
  changed: () => void,
) => {
  const atoms = (table as { atoms: Record<string, WatchedAtom | undefined> })
    .atoms
  const keyOf = () => JSON.stringify(slices.map(name => atoms[name]?.get()))
  const key = keyOf()
  const subscriptions = slices.map(name =>
    atoms[name]?.subscribe(() => {
      if (keyOf() !== key) changed()
    }),
  )
  return () => {
    for (const subscription of subscriptions) subscription?.unsubscribe()
  }
}

/** First answer for a branch: the rows that arrived and the branch total, or their count if it's unknown. */
export interface BranchArrival {
  rowIds: readonly string[]
  count: number
}

/** A new row and its place in the list. */
export interface NewRowPlace {
  id: string
  index: number
}

/** A list change: `delta` rows were inserted at `at`; removed when `delta < 0`. */
export interface RowListChange {
  at: number
  delta: number
}

/** Failure to load rows `[start, end)` (ADR 0138, §11). */
export interface RowFailure {
  start: number
  end: number
  reason?: string
  retry: () => void
}

export interface RowLoadError {
  reason?: string
  retry: () => void
}

/** Mounted body rows `[first, last]` and fast scrolling. */
export interface RowWindow {
  first: number
  last: number
  fast: boolean
}

type ModelRow = {
  id: string
  index: number
  getLeafRows?: () => readonly { getIsGrouped?: () => boolean }[]
}
type ById = { rowsById: Record<string, ModelRow | undefined> }

interface ModelTable {
  getRowModel: () => { rows: ModelRow[] } & ById
  getPrePaginatedRowModel: () => ById
  getCoreRowModel: () => ById & { flatRows: ModelRow[] }
}

/** Места строк по `id` — одна карта на список: выделение ищет места на каждой отрисовке. */
const listIndexes = new WeakMap<readonly ModelRow[], Map<string, number>>()

const groupDataRows = new WeakMap<readonly object[], number>()

/** Строк данных в группе: потомки без строк-подгрупп; счёт — один на модель. */
const dataRowsInGroup = (row: ModelRow) => {
  const descendants = row.getLeafRows?.()
  if (!descendants) return undefined
  let count = groupDataRows.get(descendants)
  if (count === undefined) {
    count = 0
    for (const item of descendants) if (!item.getIsGrouped?.()) count++
    groupDataRows.set(descendants, count)
  }
  return count
}

/** Источник клиентского режима: список — выход движка строк (ADR 0200, §2). */
export const createClientRowSource = (table: unknown): RowSource => {
  const t = table as ModelTable
  const engine = engineOf(table as object)
  let settled: unknown
  const list = () => {
    const model = engine.last() as ReturnType<ModelTable['getRowModel']>
    if (model !== settled) {
      settled = model
      engine.settle()
    }
    return model
  }
  return {
    count: () => list().rows.length,
    at: index => list().rows[index],
    // Как `getRow(id, true)` TanStack — строки групп и других страниц, но без исключения.
    byId: id =>
      (engine.input('page') as ById).rowsById[id] ??
      t.getCoreRowModel().rowsById[id],
    indexOf: id => {
      const { rows, rowsById } = list()
      // Строка стоит на своём индексе (плоский список без сортировки) — без обхода списка.
      const row = rowsById[id]
      if (row && rows[positionOf(row)] === row) return positionOf(row)
      let indexes = listIndexes.get(rows)
      if (!indexes) {
        indexes = new Map(rows.map((item, index) => [item.id, index]))
        listIndexes.set(rows, indexes)
      }
      return indexes.get(id) ?? -1
    },
    loadedRows: () => t.getCoreRowModel().flatRows,
    groupRowCount: row => dataRowsInGroup(row as ModelRow),
    rows: () => list().rows,
  }
}

/** Поиск строки в версии данных до обновления, включая строки за пределами окна. */
export const snapshotDataRows = (table: unknown) => {
  const model = (table as Table<any, any>).getCoreRowModel()
  return (id: string): Row<any, any> | undefined => model.rowsById[id]
}

/** Источник строк таблицы (метод `commonFeature`). */
export const rowSourceOf = <TRow = unknown>(table: unknown): RowSource<TRow> =>
  (table as { getRowSource: () => RowSource<TRow> }).getRowSource()

/** Строки данных: выгрузка и счётчики не видят строк до сохранения (ADR 0178, §7). */
export const dataRowSourceOf = <TRow = unknown>(
  table: unknown,
): RowSource<TRow> => {
  const source = rowSourceOf<TRow>(table)
  return source.base ?? source
}
