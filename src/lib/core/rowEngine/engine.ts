/**
 * Движок строк (ADR 0200): конвейер стадий в постоянном порядке — фильтр и поиск,
 * группировка, сортировка, раскрытие, страница. Движок сам передаёт выход стадии следующей;
 * слоты моделей TanStack отдают выход стадии в стоковом виде (ADR 0200, §6).
 */

import { releaseRowModelChange } from '../dataChanges'
import { forgetRowChange } from '../rowChanges'
import { hasShownChildren } from './displayChildren'
import { stockView, type ViewKind } from './stockView'

export type StageId = 'filter' | 'group' | 'sort' | 'expand' | 'page'

/** Стадии по порядку: слот модели TanStack, ручной режим, модели входа и выхода. */
export const STAGES = [
  {
    id: 'filter',
    slot: 'filteredRowModel',
    manual: 'manualFiltering',
    input: 'getPreFilteredRowModel',
    output: 'getFilteredRowModel',
  },
  {
    id: 'group',
    slot: 'groupedRowModel',
    manual: 'manualGrouping',
    input: 'getPreGroupedRowModel',
    output: 'getGroupedRowModel',
  },
  {
    id: 'sort',
    slot: 'sortedRowModel',
    manual: 'manualSorting',
    input: 'getPreSortedRowModel',
    output: 'getSortedRowModel',
  },
  {
    id: 'expand',
    slot: 'expandedRowModel',
    manual: 'manualExpanding',
    input: 'getPreExpandedRowModel',
    output: 'getExpandedRowModel',
  },
  {
    id: 'page',
    slot: 'paginatedRowModel',
    manual: 'manualPagination',
    input: 'getPrePaginatedRowModel',
    output: 'getPaginatedRowModel',
  },
] as const satisfies readonly {
  id: StageId
  slot: string
  manual: string
  input: string
  output: string
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

interface EngineTable {
  options: Record<string, unknown> & { features?: Record<string, unknown> }
  getCoreRowModel: () => unknown
  [getter: string]: unknown
}

/** Движок таблицы: стадии в постоянном порядке, выход стадии — вход следующей. */
export interface RowEngine {
  /** Выход стадии; стадия в ручном режиме, без плагина и при хранилище блоков отдаёт вход. */
  output: (id: StageId) => unknown
  /** Вход стадии: выход предыдущей стадии с плагином, без неё — модель ядра. */
  input: (id: StageId) => unknown
  /** Выход последней стадии — строки тела. */
  last: () => unknown
  /** Конвейер досчитан: записи смен моделей отпускают прежние модели и строки (EN26). */
  settle: () => void
}

const engines = new WeakMap<object, RowEngine>()

const createEngine = (table: object): RowEngine => {
  const t = table as EngineTable
  const runs = new Map<StageId, StageRun>()
  const slotAt = (at: number) => t.options.features?.[STAGES[at]!.slot]
  const stageAt = (at: number) => stageOfSlot(slotAt(at))
  /** Выход места конвейера: своя стадия — движком, чужой слот — моделью TanStack. */
  const outputAt = (at: number) =>
    stageAt(at)
      ? engine.output(STAGES[at]!.id)
      : (t[STAGES[at]!.output] as () => unknown)()
  const indexOf = (id: StageId) => STAGES.findIndex(step => step.id === id)
  const engine: RowEngine = {
    input: id => {
      for (let at = indexOf(id) - 1; at >= 0; at--) {
        if (slotAt(at)) return outputAt(at)
      }
      return t.getCoreRowModel()
    },
    output: id => {
      const at = indexOf(id)
      const stage = stageAt(at)
      // Хранилище блоков (ADR 0138): порядок, отбор и группы — с сервера, стадии не идут.
      if (!stage || t.options[STAGES[at]!.manual] || t.options.getRowSource) {
        return engine.input(id)
      }
      let run = runs.get(id)
      if (!run) {
        run = stage.create(table)
        runs.set(id, run)
      }
      return run(() => engine.input(id))
    },
    last: () => {
      for (let at = STAGES.length - 1; at >= 0; at--) {
        if (slotAt(at)) return outputAt(at)
      }
      return t.getCoreRowModel()
    },
    settle: () => {
      // Подсказку виртуализатору спрашивают только у итогового списка: прочие отпускаются.
      const last = (engine.last() as { rows: object }).rows
      const release = (model: object) => {
        releaseRowModelChange(model)
        const { rows } = model as { rows: object }
        if (rows !== last) forgetRowChange(rows)
      }
      release(t.getCoreRowModel() as object)
      for (const step of STAGES) release(engine.output(step.id) as object)
    },
  }
  return engine
}

/**
 * Движок таблицы; один на экземпляр. Ключ — хранилище таблицы: React-адаптер отдаёт на рендер
 * новый объект таблицы с тем же хранилищем.
 */
export const engineOf = (table: object): RowEngine => {
  const key = (table as { store?: object }).store ?? table
  let engine = engines.get(key)
  if (!engine) {
    engine = createEngine(table)
    engines.set(key, engine)
  }
  return engine
}

/** Вид выхода стадии: деревья — фильтр, группировка, сортировка; списки — раскрытие и страница. */
const KIND: Record<StageId, ViewKind> = {
  filter: 'tree',
  group: 'tree',
  sort: 'tree',
  expand: 'list',
  page: 'page',
}

const makeSlot = <F extends SlotFactory>(stage: RowStage): F => {
  const step = STAGES.find(item => item.id === stage.id)!
  const slot = ((table: object) => () => {
    const engine = engineOf(table)
    const output = engine.output(stage.id)
    // Стоковый вид входа — у модели TanStack перед слотом.
    const inputView = () =>
      (table as Record<string, () => unknown>)[step.input]!()
    if (output === engine.input(stage.id)) return inputView()
    return hasShownChildren(output as object)
      ? stockView(output, KIND[stage.id], inputView)
      : output
  }) as unknown as F
  stages.set(slot, stage)
  return slot
}

/** Слот своей стадии: вход берёт у движка (ADR 0200, §3); тип годится любому слоту модели. */
type OwnSlot = (table: unknown) => () => never

export const ownStage = <F extends SlotFactory = OwnSlot>(
  id: StageId,
  create: (table: never) => StageRun,
): F => makeSlot<F>({ id, create: create as (table: unknown) => StageRun })
