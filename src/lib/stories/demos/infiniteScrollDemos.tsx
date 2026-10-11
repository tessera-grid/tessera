/**
 * Демо ленты (ADR 0081): у края грид зовёт `onLoadMore`, «сервер» с задержкой
 * отвечает блоком, история дописывает его в конец `data`. Режимы — известный и
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
} from '../../plugins/columnFiltering/conditions'
import {
  matchesSearch,
  normalizeSearch,
} from '../../plugins/quickSearch/search'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import {
  type FilteringItem,
  filteringColumns,
  makeFilteringData,
} from '../__mocks__/filteringData'
import { DemoButton, DemoItem, DemoNote, DemoPanel } from './DemoPanel'

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

const SERVER_TOTAL = 1000
const SERVER_DATA = makeFilteringData(SERVER_TOTAL)

type Filters = { id: string; value: unknown }[]

interface Query {
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
const select = ({ sort, filters, search, columnIds }: Query) => {
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

const INITIAL_QUERY: Query = { filters: [], search: '', columnIds: [] }

export const InfiniteScrollDemo = ({
  serverDelayMs = 700,
  blockSize = 50,
  knownTotal = true,
  failFirstAttempt: initialFailures = false,
  failureReason = 'Server error: 503 Service Unavailable',
  serverQuery = false,
  ...args
}: InfiniteScrollDemoProps) => {
  const [rows, setRows] = useState(() => SERVER_DATA.slice(0, blockSize))
  const [total, setTotal] = useState(SERVER_TOTAL)
  const [loading, setLoading] = useState(false)
  const [failures, setFailures] = useState(initialFailures)
  const [requests, setRequests] = useState(0)
  const [failed] = useState(() => new Set<number>())
  const query = useRef<Query>(INITIAL_QUERY)
  const reloadSeq = useRef(0)

  // Аргументы-функции плагинов ядро держит стабильными (ADR 0039): useCallback не нужен.
  const onLoadMore = ({ signal, loaded }: InfiniteScrollLoadContext) =>
    new Promise<void>((resolve, reject) => {
      setRequests(count => count + 1)
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

  const restart = () => {
    query.current = { ...query.current }
    reload()
  }

  const hasMore = rows.length < total

  return (
    <div>
      <DemoPanel
        status={
          <DemoNote>
            Загружено {rows.length} из {total} · запросов {requests}
          </DemoNote>
        }
      >
        <DemoItem
          title="Прокрутка"
          hint="Прокрутите вниз: за экран до конца загруженных строк грид просит следующий блок, пока он в пути — внизу скелет-строки."
        />
        <DemoItem
          title="Сбой загрузки"
          hint="Первая попытка каждого блока падает: внизу строка ошибки, «Retry» повторяет запрос."
        >
          <DemoButton pressed={failures} onClick={() => setFailures(on => !on)}>
            {failures ? 'Выключить сбои' : 'Включить сбои'}
          </DemoButton>
        </DemoItem>
        {serverQuery && (
          <DemoItem
            title="Сортировка, фильтры и поиск"
            hint="Новое условие выборки возвращает тело в начало и отменяет блок в пути; первую порцию заново грузит приложение."
          />
        )}
        <DemoItem
          title="Начать заново"
          hint="Оставить только первый блок строк."
        >
          <DemoButton onClick={restart}>Сбросить</DemoButton>
        </DemoItem>
      </DemoPanel>
      <StoryComponent
        {...args}
        columnsOverride={filteringColumns}
        dataOverride={rows}
        enableLoading={loading}
        enableInfiniteScroll
        infiniteScrollOptions={{
          onLoadMore,
          hasMore,
          rowCount: knownTotal ? total : undefined,
          loadedCount: true,
          ...args.infiniteScrollOptions,
        }}
        {...(serverQuery && {
          enableColumnSorting: true,
          serverColumnSorting: true,
          enableMultiSort: false,
          onToggleColumnSort,
          enableColumnFiltering: true,
          enableQuickSearch: true,
          columnFilteringOptions: { server: true, onFilterChange },
          quickSearchOptions: { server: true, onSearchChange },
        })}
      />
    </div>
  )
}
