/**
 * Черновик фильтра колонки (ADR 0154, ADR 0178, §2): в серверном режиме условие уходит кнопкой
 * «Применить», а набранное лежит в реестре черновиков ядра записью вида `columnFilter` с целью
 * «колонка», пока его не применили, не сбросили и фильтр колонки не сменили снаружи — так оно
 * переживает закрытие панели, отмену и отказ. Запись есть, только пока условие отличается от
 * действующего. В клиентском режиме панель применяет условие сама, черновика нет.
 */
import { useState } from 'react'

import {
  activeDrafts,
  type Draft,
  type DraftKind,
  readDrafts,
  removeDraft,
  setDraft as putDraft,
} from '../../core/drafts/drafts'
import {
  columnFiltersOf,
  setColumnFilterByUser,
  setColumnFiltersByUser,
  withColumnFilter,
} from '../../shared/filtering/filtering'
import { useTableState } from '../../core/reactivity'
import { isServerAction, type RejectedSlices } from '../../core/serverActions'
import type { ColumnFilterValue } from '../columnFilteringModel/types'
import { filterOptionLabelOf } from '../columnFilteringModel/options'
import { formatDataTypeValue } from '../../core/dataTypeFormat'
import { describeFilter } from './describeFilter'
import type { TableLabels } from '../../core/localization'

export const COLUMN_FILTER_DRAFT = 'columnFilter'

const keyOf = (value: unknown) => JSON.stringify(value ?? null)

type FilterTable = {
  atoms?: { columnFilters?: { get: () => unknown } }
  getColumn?: (id: string) =>
    | {
        getFilterFn?: () => { autoRemove?: (value: unknown) => boolean }
      }
    | undefined
}

const appliedOf = (table: unknown, columnId: string) =>
  (
    ((table as FilterTable).atoms?.columnFilters?.get() as
      { id: string; value: unknown }[] | undefined) ?? []
  ).find(filter => filter.id === columnId)?.value

/** Условие, которое фильтр колонки снял бы (пустой текст), — это «нет фильтра». */
const normalized = (table: unknown, columnId: string, value: unknown) => {
  const autoRemove = (table as FilterTable)
    .getColumn?.(columnId)
    ?.getFilterFn?.()?.autoRemove
  return value === undefined || value === null || autoRemove?.(value)
    ? undefined
    : value
}

const draftOfColumn = (table: unknown, columnId: string) =>
  readDrafts(table).find(
    draft =>
      draft.kind === COLUMN_FILTER_DRAFT &&
      'column' in draft.target &&
      draft.target.column === columnId,
  )

/** Записать черновик колонки; совпал с действующим — снять запись (DR5). */
export const storeFilterDraft = (
  table: unknown,
  columnId: string,
  value: unknown,
) => {
  const target = normalized(table, columnId, value)
  if (keyOf(target) === keyOf(appliedOf(table, columnId))) {
    removeDraft(table, COLUMN_FILTER_DRAFT, { column: columnId })
    return
  }
  putDraft(table, {
    kind: COLUMN_FILTER_DRAFT,
    target: { column: columnId },
    value: target ?? null,
  })
}

type Filters = readonly { id: string; value: unknown }[] | undefined

const appliedKeys = (filters: Filters) =>
  new Map((filters ?? []).map(filter => [filter.id, keyOf(filter.value)]))

/**
 * Действующий фильтр колонки сменился — применением черновика или снаружи (ADR 0154, FD6):
 * черновик колонки уходит. Отказ сервера кладёт его обратно (`rejectFilterDrafts`).
 */
export const followFilterDrafts = (table: unknown) => {
  const atom = (
    table as {
      atoms?: {
        columnFilters?: {
          get: () => unknown
          subscribe: (listener: () => void) => { unsubscribe: () => void }
        }
      }
    }
  ).atoms?.columnFilters
  if (!atom) return undefined
  let before = appliedKeys(atom.get() as Filters)
  const subscription = atom.subscribe(() => {
    const now = appliedKeys(atom.get() as Filters)
    for (const draft of readDrafts(table)) {
      if (draft.kind !== COLUMN_FILTER_DRAFT || !('column' in draft.target))
        continue
      const columnId = draft.target.column
      if (now.get(columnId) !== before.get(columnId))
        removeDraft(table, COLUMN_FILTER_DRAFT, draft.target)
    }
    before = now
  })
  return () => subscription.unsubscribe()
}

/**
 * Сервер отказал фильтру (ADR 0178, §2): срез фильтров — к подтверждённому, отказанные условия
 * колонок — черновиками; кнопка фильтра показывает подтверждённое.
 */
export const rejectFilterDrafts = (
  table: unknown,
  { attempted, confirmed }: RejectedSlices,
) => {
  const tried = new Map(
    ((attempted.columnFilters as Filters) ?? []).map(f => [f.id, f.value]),
  )
  const was = appliedKeys(confirmed.columnFilters as Filters)
  ;(
    table as { setColumnFilters?: (filters: never) => void }
  ).setColumnFilters?.(((confirmed.columnFilters as Filters) ?? []) as never)
  for (const columnId of new Set([...tried.keys(), ...was.keys()])) {
    if (keyOf(tried.get(columnId)) === (was.get(columnId) ?? keyOf(undefined)))
      continue
    putDraft(table, {
      kind: COLUMN_FILTER_DRAFT,
      target: { column: columnId },
      value: tried.get(columnId) ?? null,
    })
  }
}

/** Черновик условия колонки работает: серверный режим, вид включён (ADR 0178, §3). */
export const hasColumnFilterDraft = (table: unknown, columnId: string) =>
  activeDrafts(table).some(
    draft =>
      draft.kind === COLUMN_FILTER_DRAFT &&
      'column' in draft.target &&
      draft.target.column === columnId,
  )

/** Условие фильтра колонки одной строкой; без условия — «Нет фильтра». */
const conditionText = (
  labels: TableLabels,
  table: unknown,
  columnId: string,
  value: unknown,
) => {
  if (value === null || value === undefined) return labels.draftNoFilter
  const column = (table as { getColumn?: (id: string) => unknown }).getColumn?.(
    columnId,
  )
  return describeFilter(value as ColumnFilterValue, labels, {
    locale: (table as { options: { locale?: string } }).options.locale,
    optionLabel: item => filterOptionLabelOf(table, column as never, item),
    numberText: item =>
      formatDataTypeValue(table as never, column as never, item, undefined),
  })
}

/** Вид черновика `columnFilter` (ADR 0178, §2): применяет «Применить» панели. */
export const columnFilterDraftKind: DraftKind = {
  kind: COLUMN_FILTER_DRAFT,
  label: labels => labels.filter,
  describe: (labels, draft, table) =>
    'column' in draft.target
      ? conditionText(labels, table, draft.target.column, draft.value)
      : labels.draftNoFilter,
  // Действующее условие колонки; без него — «Нет фильтра».
  previous: (labels, draft, table) =>
    'column' in draft.target
      ? conditionText(
          labels,
          table,
          draft.target.column,
          columnFiltersOf(table).find(
            filter =>
              'column' in draft.target && filter.id === draft.target.column,
          )?.value ?? null,
        )
      : undefined,
  apply: (table, draft: Draft) => {
    if (!('column' in draft.target)) return
    setColumnFilterByUser(table, draft.target.column, draft.value ?? undefined)
  },
  // Все условия — одним серверным действием, после данных (ADR 0178, §5).
  applyAll: (table, drafts) => applyFilterDrafts(table, drafts),
  sectionLabel: labels => labels.filters,
  stage: 'view',
  active: table => isServerAction(table, 'filtering'),
}

/** Условия черновиков — одним серверным действием (ADR 0178, §5). */
const applyFilterDrafts = (table: unknown, drafts: readonly Draft[]) => {
  const current = columnFiltersOf(table)
  const next = drafts.reduce(
    (filters, draft) =>
      'column' in draft.target
        ? withColumnFilter(
            table,
            filters,
            draft.target.column,
            draft.value ?? undefined,
          )
        : filters,
    current,
  )
  if (next !== current) setColumnFiltersByUser(table, next)
}

interface FilterDraftArgs<D> {
  table: unknown
  columnId: string
  /** Действующий фильтр колонки при открытии панели. */
  current: unknown
  draftOf: (current: ColumnFilterValue | undefined) => D
  /** Значение фильтра из черновика; `null` — ввод не применим. */
  filterOf: (draft: D) => ColumnFilterValue | undefined | null
}

export const useFilterDraft = <D>({
  table,
  columnId,
  current,
  draftOf,
  filterOf,
}: FilterDraftArgs<D>) => {
  const server = isServerAction(table, 'filtering')
  const applied = useTableState(
    table as never,
    state =>
      (
        (state as { columnFilters?: { id: string; value: unknown }[] })
          .columnFilters ?? []
      ).find(filter => filter.id === columnId)?.value,
  )
  const [draft, setLocal] = useState<D>(() => {
    const saved = server ? draftOfColumn(table, columnId) : undefined
    return draftOf(
      (saved ? (saved.value ?? undefined) : current) as
        ColumnFilterValue | undefined,
    )
  })

  const built = filterOf(draft)
  const target =
    built === null ? null : (normalized(table, columnId, built) as unknown)

  const setDraft = (next: D) => {
    setLocal(next)
    if (!server) return
    const value = filterOf(next)
    // Ввод не применим (число с ошибкой) — в реестре остаётся прежнее условие.
    if (value !== null) storeFilterDraft(table, columnId, value)
  }

  return {
    server,
    draft,
    setDraft,
    /** Условие отличается от действующего и применимо. */
    dirty: target !== null && keyOf(target) !== keyOf(applied),
    /** «Применить»: отправить условие черновика. */
    commit: () => {
      if (target === null) return
      setColumnFilterByUser(table, columnId, target)
    },
    /** «Сбросить»: черновика больше нет. */
    forget: () => removeDraft(table, COLUMN_FILTER_DRAFT, { column: columnId }),
  }
}
