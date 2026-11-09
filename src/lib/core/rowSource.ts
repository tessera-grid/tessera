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

/** Строки тела: по индексу в списке и по id. */
export interface RowSource<TRow = unknown> {
  /** Строк в списке, в том числе ещё не загруженных. */
  count: () => number
  /** Строка по индексу в списке; `undefined` — нет или ещё не загружена. */
  at: (index: number) => TRow | undefined
  /**
   * Ключ строки виртуализатора — её индекс, а не id: виртуализатор спрашивает ключи всех строк
   * на каждой смене их числа, а замер высоты остаётся за местом в списке (ADR 0138, §14).
   */
  keyByIndex?: boolean
  /** Строка данных по id, в том числе не показанная в списке (свёрнутая, на другой странице). */
  byId: (id: string) => TRow | undefined
  /** Индекс строки в списке; `-1` — её нет в списке. */
  indexOf: (id: string) => number
  /** Строки данных, что есть у грида, и вне списка: другая страница, свёрнутая ветка. */
  loadedRows: () => Iterable<TRow>
  /** Ветка раскрытой строки ждёт первого ответа источника (ADR 0155, §3). */
  branchLoading?: (id: string) => boolean
  /** Отменить загрузку ветки: человек отменил раскрытие. */
  cancelBranch?: (id: string) => void
  /**
   * Позвать `done` на первый ответ ветки, которую раскрыл человек; ветка уже в кэше, отказ,
   * отмена запроса окном или сворачиванием, новая выборка — вызова нет (ADR 0138, SD55–SD60).
   */
  whenBranchArrives?: (
    id: string,
    done: (arrival: BranchArrival) => void,
  ) => void
  /**
   * Весь список массивом, если он загружен целиком (клиентский режим). Без него дерево,
   * линии, движение строк и место броска в теле не считаются.
   */
  rows?: () => readonly TRow[]
  /** Окно строк тела с запасом и быстрая прокрутка (ADR 0008): источник грузит по ним. */
  observe?: (window: RowWindow) => void
  /** Отказавшие участки списка: на их месте тело рисует строку ошибки с повтором. */
  failures?: () => readonly RowFailure[]
  /**
   * Отказ, когда не загружено ничего: вместо тела — заглушка ошибки (ADR 0096). Тот же
   * объект, пока отказ тот же.
   */
  loadError?: () => RowLoadError | undefined
  /** Сортировка, фильтры или поиск сменились: список начинается заново (ADR 0138, §6). */
  sync?: () => void
  /**
   * Строки окна под текущей выборкой пришли; отказ — причиной блока. Промис серверного
   * действия вместо ответа приложения (ADR 0116).
   */
  whenLoaded?: () => PromiseLike<void>
  /** Окно новой выборки ещё идёт: прежние строки под свечением обновления (ADR 0094). */
  refreshing?: () => boolean
  /** Итог для `aria-rowcount`, `-1` — неизвестен; главнее опции `getTotalRowCount`. */
  total?: () => number
  /**
   * `aria-*` дерева строки по индексу: уровень, место среди соседей и их число — для
   * строк, которых нет в массиве `rows` (серверная модель, ADR 0138, §14).
   */
  treeAria?: (
    index: number,
  ) => { level: number; posInSet: number; setSize: number } | undefined
  /** `id` предков строки дерева от корня (серверная модель, ADR 0162). */
  ancestors?: (id: string) => readonly string[]
  /**
   * Строк в ветке на всех уровнях, у корня (`undefined`) — во всём дереве; неизвестно —
   * `undefined` (серверная модель, ADR 0162).
   */
  subtreeSize?: (parentId: string | undefined) => number | undefined
  /**
   * Линии дерева строки по индексу — из раскладки, без прохода по строкам (серверная
   * модель, ADR 0161).
   */
  treeLines?: (
    index: number,
  ) => { depth: number; branch: string; open: boolean } | undefined
  /** Строк верхнего уровня: «Выбрать всё» в дереве — их итог. */
  rootCount?: () => number
  /** Итог строк верхнего уровня известен; без него пейджер — «из многих» (ADR 0158, §4). */
  rootCountKnown?: () => boolean
  /**
   * Сквозной индекс первой строки источника: источник — страница списка (ADR 0158), его
   * индексы — от её начала.
   */
  offset?: () => number
  /** Индексы строк верхнего уровня текущей страницы, от её начала (ADR 0188). */
  pageRootIndexes?: () => number[]
  /** Страница, где стоит строка со сквозным индексом; `undefined` — такой строки нет. */
  pageOf?: (listIndex: number) => number | undefined
  /** Сквозной индекс строки, в том числе на другой странице; `-1` — её нет в списке. */
  listIndexOf?: (id: string) => number
  /**
   * Строк в ветке `parentId` (без него — корней) и известен ли её итог; ветка не раскрыта —
   * `undefined` (ADR 0159, §4).
   */
  branchSize?: (
    parentId: string | undefined,
  ) => { count: number; known: boolean } | undefined
  /** Загруженная строка на месте `index` ветки `parentId` (без него — корней); нет — `undefined`. */
  rowIn?: (parentId: string | undefined, index: number) => TRow | undefined
  /**
   * Перенести строку на место `index` в ветке `parentId` (без него — среди корней) — сразу,
   * без запроса (ADR 0159, §2, §4). Строки нет в кэше — встаёт по данным `stray.original`, а
   * её место `stray.from` закрывается; без них — `false`. Ветка не загружена — `false`.
   */
  moveRow?: (
    id: string,
    place: { parentId?: string; index: number },
    stray?: {
      original: unknown
      from: { parentId?: string; index: number }
    },
  ) => boolean
  /** Строк в группе по строке-группе (серверная группировка, ADR 0144); иначе — нет. */
  groupChildCount?(row: TRow): number | undefined
  /** Строк данных в группе — для подписи (ADR 0184, §8); неизвестно — `undefined`. */
  groupRowCount?(row: TRow): number | undefined
  /** Итоги колонок выборки — из ответа сервера (ADR 0144, §4). */
  totals?: () => Record<string, unknown> | undefined
  /** Строк данных в выборке при серверной группировке (ADR 0144, §5). */
  leafCount?: () => number | undefined
  /** Номер выборки: растёт с новой сортировкой, фильтрами, поиском и сбросом кэша. */
  epoch?: () => number
  /** Номер раскладки списка: растёт с каждой сменой строк по индексам. */
  version?: () => number
  /**
   * Смены списка после раскладки `version`, каждая — в индексах раскладки перед ней;
   * `undefined` — журнал её не помнит (ADR 0146, §6).
   */
  changesSince?: (version: number) => readonly RowListChange[][] | undefined
  /** Строки `[first, last]`: загруженные — сразу, прочие — запросом мимо кэша окна. */
  loadRange?: (
    first: number,
    last: number,
    signal: AbortSignal,
  ) => Promise<readonly (TRow | undefined)[]>
  /**
   * Все строки списка на всех страницах: загруженные и запросом мимо кэша (ADR 0190). Строк
   * больше `limit` — `undefined`: известный итог проверяется до запросов.
   */
  loadList?: (
    limit: number,
    signal: AbortSignal,
  ) => Promise<readonly TRow[] | undefined>
  /** Источник под слоем строк до сохранения (ADR 0178, §7): строки данных без новых. */
  base?: RowSource<TRow>
  /** Новые строки слоя и их места в списке; журнал смен о них не знает (ADR 0178, DR50). */
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

/** Первый ответ ветки: пришедшие строки и итог ветки, а если он неизвестен — их число. */
export interface BranchArrival {
  rowIds: readonly string[]
  count: number
}

/** Новая строка и её место в списке. */
export interface NewRowPlace {
  id: string
  index: number
}

/** Смена списка: в месте `at` вставлено `delta` строк, при `delta < 0` — удалено. */
export interface RowListChange {
  at: number
  delta: number
}

/** Отказ загрузки строк `[start, end)` (ADR 0138, §11). */
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

/** Смонтированные строки тела `[first, last]` и быстрая прокрутка. */
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
