/**
 * Черновик фильтра колонки (ADR 0154): в серверном режиме условие уходит кнопкой
 * «Применить», а набранное хранится по колонке, пока его не применили, не сбросили и фильтр
 * колонки не сменили снаружи — так оно переживает закрытие панели, отмену и отказ. В
 * клиентском режиме панель применяет условие сама, черновик не хранится.
 */
import { useState } from 'react'

import { setColumnFilterByUser } from '../../core/filtering'
import { useTableState } from '../../core/reactivity'
import { isServerAction } from '../../core/serverActions'
import type { ColumnFilterValue } from '../columnFilteringModel/types'

interface Entry {
  draft: unknown
  /** Действующий фильтр, когда черновик начат: к нему откатывает отмена. */
  base: string
  /** Отправленное кнопкой «Применить». */
  sent?: string
}

const drafts = new WeakMap<object, Map<string, Entry>>()

const keyOf = (value: unknown) => JSON.stringify(value ?? null)

const entriesOf = (table: unknown) => {
  const store = (table as { store?: object }).store
  if (!store) return undefined
  let entries = drafts.get(store)
  if (!entries) {
    entries = new Map()
    drafts.set(store, entries)
  }
  return entries
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
    const entries = entriesOf(table)
    const entry = server ? entries?.get(columnId) : undefined
    const now = keyOf(current)
    // Черновик жив, пока действующий фильтр — его начало или им же отправленное.
    if (
      entry &&
      (entry.base === now || entry.sent === now) &&
      keyOf(filterOf(entry.draft as D)) !== now
    ) {
      return entry.draft as D
    }
    entries?.delete(columnId)
    return draftOf(current as ColumnFilterValue | undefined)
  })

  const setDraft = (next: D) => {
    setLocal(next)
    if (!server) return
    const entries = entriesOf(table)
    const entry = entries?.get(columnId)
    entries?.set(columnId, {
      draft: next,
      base: entry?.base ?? keyOf(applied),
      sent: entry?.sent,
    })
  }

  const built = filterOf(draft)
  // Условие, которое фильтр колонки снял бы (пустой текст), — это «нет фильтра».
  const autoRemove = (
    table as {
      getColumn?: (
        id: string,
      ) =>
        | { getFilterFn?: () => { autoRemove?: (value: unknown) => boolean } }
        | undefined
    }
  )
    .getColumn?.(columnId)
    ?.getFilterFn?.()?.autoRemove
  const target = built && autoRemove?.(built) ? undefined : built
  return {
    server,
    draft,
    setDraft,
    /** Условие отличается от действующего и применимо. */
    dirty: target !== null && keyOf(target) !== keyOf(applied),
    /** «Применить»: отправить условие черновика. */
    commit: () => {
      if (target === null) return
      const entry = entriesOf(table)?.get(columnId)
      if (entry) entry.sent = keyOf(target)
      setColumnFilterByUser(table, columnId, target)
    },
    /** «Сбросить»: черновика больше нет. */
    forget: () => entriesOf(table)?.delete(columnId),
  }
}
