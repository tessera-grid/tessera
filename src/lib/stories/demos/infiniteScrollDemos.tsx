/**
 * Лента (ADR 0081): у края грид зовёт `onLoadMore`, «сервер» с задержкой
 * отвечает блоком, история дописывает его в конец `data`. Режимы `Playground` — известный и
 * неизвестный итог, сбои с повтором, серверные сортировка, фильтры и поиск.
 */
import { useRef, useState } from 'react'

import type {
  ColumnFilterValue,
  InfiniteScrollLoadContext,
} from '../../plugins'
import {
  filterTypeOf,
  matchesColumnFilter,
} from '../../plugins/columnFilteringModel/conditions'
import {
  matchesSearch,
  normalizeSearch,
} from '../../plugins/quickSearchModel/search'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import {
  type FilteringItem,
  filteringColumns,
  makeFilteringData,
} from '../__mocks__/filteringData'

export interface InfiniteScrollDemoProps extends StoryProps {
  /** Время ответа «сервера», мс. */
  serverDelayMs?: number
  /** Строк в блоке. */
  blockSize?: number
  /** Сервер сообщает итог: `rowCount`; иначе только `hasMore`. */
  knownTotal?: boolean
  /** Первая попытка каждого блока падает, повтор проходит. */
  failFirstAttempt?: boolean
  /** Причина отказа «сервера». */
  failureReason?: string
  /** Сортировка, фильтры колонок и поиск — на сервере. */
  serverQuery?: boolean
}

export const SERVER_TOTAL = 1000
export const SERVER_DATA = makeFilteringData(SERVER_TOTAL)

type Filters = { id: string; value: unknown }[]

export interface Query {
  sort?: { id: string; desc: boolean }
  filters: Filters
  search: string
  columnIds: string[]
}

const compareValues = (a: unknown, b: unknown) =>
  typeof a === 'string'
    ? a.localeCompare(String(b), undefined, { numeric: true })
    : Number(a) - Number(b)

/** «Сервер»: весь набор под условием выборки. */
export const select = ({ sort, filters, search, columnIds }: Query) => {
  const needle = normalizeSearch(search)
  const rows = SERVER_DATA.filter(
    row =>
      filters.every(({ id, value }) => {
        const def = filteringColumns.find(column => column.id === id) as
          { filter?: Parameters<typeof filterTypeOf>[0] } | undefined
        const type = filterTypeOf(def?.filter)
        return (
          !type ||
          matchesColumnFilter(
            type,
            row[id as keyof FilteringItem],
            value as ColumnFilterValue,
          )
        )
      }) &&
      (needle === '' ||
        columnIds.some(id =>
          matchesSearch(row[id as keyof FilteringItem], needle),
        )),
  )
  if (!sort) return rows
  return [...rows].sort((a, b) => {
    const order = compareValues(
      a[sort.id as keyof FilteringItem],
      b[sort.id as keyof FilteringItem],
    )
    return sort.desc ? -order : order
  })
}

export const INITIAL_QUERY: Query = { filters: [], search: '', columnIds: [] }

export const InfiniteScrollDemo = ({
  serverDelayMs = 700,
  blockSize = 50,
  knownTotal = true,
  failFirstAttempt: failures = false,
  failureReason = 'Server error: 503 Service Unavailable',
  serverQuery = false,
  ...args
}: InfiniteScrollDemoProps) => {
  const [rows, setRows] = useState(() => SERVER_DATA.slice(0, blockSize))
  const [total, setTotal] = useState(SERVER_TOTAL)
  const [loading, setLoading] = useState(false)
  const [failed] = useState(() => new Set<number>())
  const query = useRef<Query>(INITIAL_QUERY)
  const reloadSeq = useRef(0)

  // Аргументы-функции плагинов ядро держит стабильными (ADR 0039): useCallback не нужен.
  const onLoadMore = ({ signal, loaded }: InfiniteScrollLoadContext) =>
    new Promise<void>((resolve, reject) => {
      window.setTimeout(() => {
        if (signal.aborted) {
          resolve()
          return
        }
        if (failures && !failed.has(loaded)) {
          failed.add(loaded)
          reject(new Error(failureReason))
          return
        }
        const block = select(query.current).slice(loaded, loaded + blockSize)
        setRows(prev => [...prev, ...block])
        resolve()
      }, serverDelayMs)
    })

  /** Новое условие выборки: первая порция — заново. */
  const reload = () => {
    const seq = ++reloadSeq.current
    setLoading(true)
    window.setTimeout(() => {
      if (seq !== reloadSeq.current) return
      const result = select(query.current)
      failed.clear()
      setTotal(result.length)
      setRows(result.slice(0, blockSize))
      setLoading(false)
    }, serverDelayMs)
  }

  const onToggleColumnSort = (
    id: string,
    direction: 'asc' | 'desc' | false,
  ) => {
    query.current = {
      ...query.current,
      sort: direction ? { id, desc: direction === 'desc' } : undefined,
    }
    reload()
  }
  const onFilterChange = (filters: Filters) => {
    query.current = { ...query.current, filters }
    reload()
  }
  const onSearchChange = (
    search: string,
    { columnIds }: { columnIds: string[] },
  ) => {
    query.current = { ...query.current, search, columnIds }
    reload()
  }

  const hasMore = rows.length < total

  return (
    <StoryComponent
      {...args}
      columnsOverride={filteringColumns}
      dataOverride={rows}
      loading={loading ? 'refresh' : false}
      enableInfiniteScroll
      onLoadMore={onLoadMore}
      infiniteScrollHasMore={hasMore}
      rowCount={knownTotal ? total : undefined}
      infiniteScrollLoadedCount={args.infiniteScrollLoadedCount ?? true}
      {...(serverQuery && {
        enableColumnSorting: true,
        dataMode: { sorting: 'server', filtering: 'server', search: 'server' },
        columnSortingMultiSort: false,
        onToggleColumnSort,
        enableColumnFiltering: true,
        enableQuickSearch: true,
        onFilterChange,
        onSearchChange,
      })}
    />
  )
}
