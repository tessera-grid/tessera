// LiveRegion: визуально скрытая область role="status" грида (ADR 0032, W9) —
// принимает table.announce и сама объявляет сортировку, число выбранных строк,
// окончание загрузки, пустой результат и число строк после фильтра или поиска (если
// enableAnnouncements !== false).
import { useEffect, useRef, useState } from 'react'

import { announceLabel, registerAnnouncer } from '../core/announcer'
import type { TableLabels } from '../core/localization'
import { useTableState } from '../core/reactivity'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'

interface LiveRegionProps {
  table: unknown
  labels: TableLabels
  loading: boolean
  rowCount: number
}

/** Вызвать `effect` при смене `value` (не на первом рендере). */
const useOnChange = <T,>(value: T, effect: (value: T, prev: T) => void) => {
  const prev = useRef(value)
  useEffect(() => {
    if (!Object.is(prev.current, value)) {
      const before = prev.current
      prev.current = value
      effect(value, before)
    }
  })
}

const columnName = (table: unknown, id: string) => {
  const header = (
    table as {
      getColumn: (id: string) => { columnDef: { header?: unknown } } | undefined
    }
  ).getColumn(id)?.columnDef.header
  return typeof header === 'string' ? header : id
}

export const LiveRegion = ({
  table,
  labels,
  loading,
  rowCount,
}: LiveRegionProps) => {
  const [message, setMessage] = useState('')

  useEffect(
    () =>
      registerAnnouncer(table, {
        labels,
        // Сброс перед записью — чтобы повтор того же текста объявлялся снова.
        say: text => {
          setMessage('')
          requestAnimationFrame(() => setMessage(text))
        },
      }),
    [table, labels],
  )

  const sorting = useTableState(table as never, state => {
    const first = (state as { sorting?: { id: string; desc: boolean }[] })
      .sorting?.[0]
    return first ? `${first.id}:${first.desc}` : ''
  }) as string
  const selected = useTableState(
    table as never,
    state =>
      Object.values(
        (state as { rowSelection?: Record<string, boolean> }).rowSelection ??
          {},
      ).filter(Boolean).length,
  ) as number

  useOnChange(sorting, value => {
    const [id, desc] = value.split(':')
    announceLabel(table, l =>
      id
        ? l.announceSort(
            columnName(table, id),
            desc === 'true' ? 'descending' : 'ascending',
          )
        : l.announceSort(null, null),
    )
  })
  // Фильтр или поиск применён — объявить число строк (ADR 0045, FL32). В серверном
  // режиме результат ещё не пришёл: о нём скажет окончание загрузки.
  const filters = useTableState(table as never, state => {
    const { columnFilters, globalFilter } = state as {
      columnFilters?: unknown
      globalFilter?: unknown
    }
    return JSON.stringify([columnFilters ?? [], globalFilter ?? ''])
  }) as string
  const filtersChanged = useRef(false)
  useOnChange(filters, () => {
    const t = table as {
      options: { manualFiltering?: boolean }
      getFilteredRowModel?: () => { rows: unknown[] }
    }
    if (t.options.manualFiltering || !t.getFilteredRowModel) return
    filtersChanged.current = true
    const count = t.getFilteredRowModel().rows.length
    announceLabel(table, l => l.announceFilteredRows(count))
  })

  useOnChange(selected, count =>
    announceLabel(table, l => l.announceSelection(count)),
  )
  useOnChange(loading, (isLoading, wasLoading) => {
    if (wasLoading && !isLoading) {
      announceLabel(table, l =>
        rowCount === 0 ? l.noData : l.announceLoaded(rowCount),
      )
    }
  })
  useOnChange(rowCount, (count, before) => {
    // Пустой результат фильтра уже объявлен числом строк.
    if (filtersChanged.current) return
    if (count === 0 && before > 0 && !loading) {
      announceLabel(table, l => l.noData)
    }
  })

  // Флаг живёт один коммит: эффекты выше уже прочли его.
  useEffect(() => {
    filtersChanged.current = false
  })

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={dataGridStyles['visually-hidden']}
    >
      {message}
    </div>
  )
}
