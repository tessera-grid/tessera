// LiveRegion: визуально скрытая область role="status" грида (ADR 0032, W9) —
// принимает table.announce и сама объявляет сортировку, число выбранных строк,
// окончание загрузки и пустой результат (если enableAnnouncements !== false).
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
    if (count === 0 && before > 0 && !loading) {
      announceLabel(table, l => l.noData)
    }
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
