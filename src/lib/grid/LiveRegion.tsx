// LiveRegion: визуально скрытая область role="status" грида (ADR 0032, W9) —
// принимает table.announce и сама объявляет сортировку, число выбранных строк,
// окончание загрузки, пустой результат и число строк после фильтра или поиска (если
// enableAnnouncements !== false).
import { type RefObject, useEffect, useRef, useState } from 'react'

import { announceLabel, registerAnnouncer } from '../core/announcer'
import type { TableLabels } from '../core/localization'
import { useTableState } from '../core/reactivity'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'

interface LiveRegionProps {
  table: unknown
  labels: TableLabels
  loading: boolean
  /** Загрузка закончилась отказом (ADR 0096): об отказе скажет своё объявление. */
  failed?: boolean
  rowCount: number
  /** Заголовок заглушки пустой таблицы: её появление объявляется (ADR 0123, ES12). */
  stubTitle?: string
  /** Узел внутри `.data-grid-theme` — сама область лежит вне темы. */
  themeNode?: RefObject<HTMLElement | null>
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
  failed = false,
  rowCount,
  stubTitle,
  themeNode,
}: LiveRegionProps) => {
  // Каждое объявление — новый узел: повтор того же текста тоже попадает в область.
  const [message, setMessage] = useState({ text: '', id: 0 })

  useEffect(
    () =>
      registerAnnouncer(table, {
        labels,
        say: text => setMessage(current => ({ text, id: current.id + 1 })),
        token: name =>
          themeNode?.current
            ? getComputedStyle(themeNode.current).getPropertyValue(name)
            : '',
        length: name => {
          const node = themeNode?.current
          if (!node) return NaN
          const probe = document.createElement('span')
          probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`
          node.append(probe)
          const width = probe.getBoundingClientRect().width
          probe.remove()
          return width
        },
      }),
    [table, labels, themeNode],
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
      !id
        ? l.announceSortCleared
        : desc === 'true'
          ? l.announceSortDescending(columnName(table, id))
          : l.announceSortAscending(columnName(table, id)),
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
  const loadingEnded = useRef(false)
  useOnChange(loading, (isLoading, wasLoading) => {
    if (wasLoading && !isLoading && !failed) {
      loadingEnded.current = true
      announceLabel(table, l =>
        rowCount === 0 ? (stubTitle ?? l.noData) : l.announceLoaded(rowCount),
      )
    }
  })
  // Появилась заглушка — объявить её заголовок; пустой результат фильтра уже объявлен
  // числом строк, конец загрузки — выше.
  useOnChange(stubTitle, title => {
    if (!title || loading || filtersChanged.current || loadingEnded.current) {
      return
    }
    announceLabel(table, () => title)
  })

  // Флаги живут один коммит: эффекты выше уже прочли их.
  useEffect(() => {
    filtersChanged.current = false
    loadingEnded.current = false
  })

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={dataGridStyles['visually-hidden']}
    >
      <span key={message.id}>{message.text}</span>
    </div>
  )
}
