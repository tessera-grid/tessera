/**
 * Демо панелей: свой пейджер при запрещённой нижней панели (ADR 0046) и серверная
 * пагинация с журналом колбэков (ADR 0038).
 */
import { useCallback, useRef, useState } from 'react'

import { useTableState } from '../../core/reactivity'
import { useCreateTable } from '../../core/useCreateTable'
import { DataGrid } from '../../grid/DataGrid'
import { pagination } from '../../plugins'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import {
  type FilteringItem,
  filteringColumns,
  makeFilteringData,
} from '../__mocks__/filteringData'
import { WithConsole } from './StoryConsole'
import { createConsoleLog, describeEvent } from './consoleLog'

const DATA = makeFilteringData(95)
const PLUGINS = [pagination({ initialPageSize: 10, pageSizes: false })] as const

const pagerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 0',
  fontFamily: 'sans-serif',
  fontSize: 14,
}

/** Нижняя панель запрещена, переключатель страниц рисует приложение на API таблицы. */
export const OwnPagerDemo = ({
  containerHeight,
  height,
  colorMode,
}: StoryProps) => {
  const table = useCreateTable({
    columns: filteringColumns as never,
    data: DATA,
    enableStatusBar: false,
    plugins: PLUGINS,
  })
  const { pageIndex } = useTableState(table, state => state.pagination)
  const pageCount = table.getPageCount()

  return (
    <div style={{ padding: 16, height: containerHeight }}>
      <div style={pagerStyle} data-testid="own-pager">
        <button
          type="button"
          data-testid="own-pager-prev"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          ‹ Prev
        </button>
        <span data-testid="own-pager-label">
          Page {pageIndex + 1} of {pageCount}
        </span>
        <button
          type="button"
          data-testid="own-pager-next"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next ›
        </button>
      </div>
      <DataGrid table={table as never} height={height} colorMode={colorMode} />
    </div>
  )
}

export interface ServerPaginationDemoProps extends StoryProps {
  /** Время ответа «сервера», мс. */
  serverDelayMs?: number
}

const SERVER_TOTAL = 230
const SERVER_DATA = makeFilteringData(SERVER_TOTAL)

type ServerSort = { id: string; desc: boolean } | undefined

const compareValues = (a: unknown, b: unknown) => {
  if (a == null || b == null) {
    return a == null ? (b == null ? 0 : 1) : -1
  }
  return typeof a === 'string'
    ? a.localeCompare(String(b), undefined, { numeric: true })
    : Number(a) - Number(b)
}

/** «Сервер»: сортирует весь набор и отдаёт одну страницу. */
const queryPage = (pageIndex: number, pageSize: number, sort: ServerSort) => {
  const rows = sort
    ? [...SERVER_DATA].sort((a, b) => {
        const order = compareValues(
          a[sort.id as keyof FilteringItem],
          b[sort.id as keyof FilteringItem],
        )
        return sort.desc ? -order : order
      })
    : SERVER_DATA
  return rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
}

/**
 * Серверная пагинация с сортировкой (ADR 0038): грид не режет и не сортирует строки —
 * страница и сортировка уходят в колбэки, «сервер» с задержкой отвечает страницей,
 * итог — `paginationRowCount`.
 */
export const ServerPaginationDemo = ({
  serverDelayMs = 400,
  ...args
}: ServerPaginationDemoProps) => {
  const [consoleLog] = useState(createConsoleLog)
  const log = consoleLog.log
  const initialPageSize = args.paginationInitialPageSize ?? 25
  const [page, setPage] = useState(() =>
    queryPage(0, initialPageSize, undefined),
  )
  const [loading, setLoading] = useState(false)
  const request = useRef({
    pageIndex: 0,
    pageSize: initialPageSize,
    sort: undefined as ServerSort,
    seq: 0,
  })
  const refetch = useCallback(() => {
    const seq = ++request.current.seq
    setLoading(true)
    window.setTimeout(() => {
      if (seq !== request.current.seq) return
      const { pageIndex, pageSize, sort } = request.current
      log(
        'server',
        `page ${pageIndex + 1} of ${Math.ceil(SERVER_TOTAL / pageSize)}` +
          (sort ? ` by ${sort.id} ${sort.desc ? 'desc' : 'asc'}` : ''),
      )
      setPage(queryPage(pageIndex, pageSize, sort))
      setLoading(false)
    }, serverDelayMs)
  }, [log, serverDelayMs])

  const onPageChange = useCallback(
    (pageIndex: number, pageSize: number) => {
      log('onPageChange', describeEvent({ pageIndex, pageSize }))
      Object.assign(request.current, { pageIndex, pageSize })
      refetch()
    },
    [log, refetch],
  )
  const onToggleColumnSort = useCallback(
    (id: string, direction: 'asc' | 'desc' | false) => {
      log('onToggleColumnSort', describeEvent({ id, direction }))
      request.current.sort = direction
        ? { id, desc: direction === 'desc' }
        : undefined
      refetch()
    },
    [log, refetch],
  )

  return (
    <WithConsole log={consoleLog} args={args}>
      <StoryComponent
        {...args}
        columnsOverride={filteringColumns}
        dataOverride={page}
        loading={loading ? 'refresh' : false}
        enablePagination
        paginationServer
        paginationRowCount={SERVER_TOTAL}
        enableColumnSorting
        columnSortingServer
        columnSortingMultiSort={false}
        onPageChange={onPageChange}
        onToggleColumnSort={onToggleColumnSort}
      />
    </WithConsole>
  )
}
