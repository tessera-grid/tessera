/**
 * Движок строк (ADR 0200): конвейер стадий в постоянном порядке — фильтр и поиск,
 * группировка, сортировка, раскрытие, страница. Слоты моделей TanStack — обёртки над
 * стадиями: стадию приносит плагин модели, вход стадии — выход предыдущей.
 */

export type StageId = 'filter' | 'group' | 'sort' | 'expand' | 'page'

/** Стадии по порядку: слот модели TanStack, ручной режим и модель входа. */
export const STAGES = [
  {
    id: 'filter',
    slot: 'filteredRowModel',
    manual: 'manualFiltering',
    input: 'getPreFilteredRowModel',
  },
  {
    id: 'group',
    slot: 'groupedRowModel',
    manual: 'manualGrouping',
    input: 'getPreGroupedRowModel',
  },
  {
    id: 'sort',
    slot: 'sortedRowModel',
    manual: 'manualSorting',
    input: 'getPreSortedRowModel',
  },
  {
    id: 'expand',
    slot: 'expandedRowModel',
    manual: 'manualExpanding',
    input: 'getPreExpandedRowModel',
  },
  {
    id: 'page',
    slot: 'paginatedRowModel',
    manual: 'manualPagination',
    input: 'getPrePaginatedRowModel',
  },
] as const satisfies readonly {
  id: StageId
  slot: string
  manual: string
  input: string
}[]

/**
 * Реализация стадии на одной таблице: выход по входу, повтор того же входа — без работы. Вход —
 * функцией: стадия, у которой выход готов, его не читает.
 */
export type StageRun = (input: () => unknown) => unknown

/** Стадия конвейера: реализация создаётся на таблицу. */
export interface RowStage {
  id: StageId
  create: (table: unknown) => StageRun
}

/** Фабрика слота модели TanStack: на таблицу — функция модели. */
type SlotFactory = (table: never) => () => unknown

const stages = new WeakMap<object, RowStage>()

/** Стадия за фабрикой слота; у слота не из движка — `undefined`. */
export const stageOfSlot = (slot: unknown): RowStage | undefined =>
  typeof slot === 'function' ? stages.get(slot) : undefined

/**
 * Слот модели TanStack — обёртка над стадией. Реализация — фабрика модели, которая сама
 * читает свой вход через модели TanStack (ADR 0200, §10): в постоянном порядке стадий это
 * выход предыдущей стадии.
 */
export const stageSlot = <F extends SlotFactory>(
  id: StageId,
  factory: F,
): F => {
  const step = STAGES.find(item => item.id === id)!
  const stage: RowStage = {
    id,
    create: table => {
      const model = factory(table as never)
      return () => model()
    },
  }
  const slot = ((table: Record<string, () => unknown>) => {
    const run = stage.create(table)
    const input = () => table[step.input]!()
    return () => run(input)
  }) as unknown as F
  stages.set(slot, stage)
  return slot
}
