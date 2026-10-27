/**
 * Источник строк (ADR 0138, §2): строки, которые рисует тело, — по индексу и по id.
 * Клиентский режим — модель строк TanStack; серверная модель строк подставит свой.
 */

/** Префикс id строки-группы серверной группировки: за ним — JSON пути групп (ADR 0144). */
export const GROUP_ROW_PREFIX = 'group:'

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
  /** Строк верхнего уровня: «Выбрать всё» в дереве — их итог. */
  rootCount?: () => number
  /** Строк в группе по строке-группе (серверная группировка, ADR 0144); иначе — нет. */
  groupChildCount?(row: TRow): number | undefined
  /** Итоги колонок выборки — из ответа сервера (ADR 0144, §4). */
  totals?: () => Record<string, unknown> | undefined
  /** Строк данных в выборке при серверной группировке (ADR 0144, §5). */
  leafCount?: () => number | undefined
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

type ById = { rowsById: Record<string, { id: string } | undefined> }

interface ModelTable {
  getRowModel: () => { rows: { id: string }[] }
  getPrePaginatedRowModel: () => ById
  getCoreRowModel: () => ById
}

/** Источник клиентского режима: список — `getRowModel().rows`. */
export const createClientRowSource = (table: unknown): RowSource => {
  const t = table as ModelTable
  return {
    count: () => t.getRowModel().rows.length,
    at: index => t.getRowModel().rows[index],
    // Как `getRow(id, true)` TanStack — строки групп и других страниц, но без исключения.
    byId: id =>
      t.getPrePaginatedRowModel().rowsById[id] ??
      t.getCoreRowModel().rowsById[id],
    indexOf: id => t.getRowModel().rows.findIndex(row => row.id === id),
    rows: () => t.getRowModel().rows,
  }
}

/** Источник строк таблицы (метод `commonFeature`). */
export const rowSourceOf = <TRow = unknown>(table: unknown): RowSource<TRow> =>
  (table as { getRowSource: () => RowSource<TRow> }).getRowSource()
