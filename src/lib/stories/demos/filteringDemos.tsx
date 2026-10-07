/**
 * Демо фильтрации (ADR 0045): серверный режим с журналом колбэков. Грид не фильтрует
 * сам — фильтры и поиск уходят в `onFilterChange` / `onSearchChange`, «сервер» с
 * задержкой отвечает отфильтрованным набором и числами для «показано N из M».
 */
import { useCallback, useMemo, useRef, useState } from 'react'

import { useLatest } from '../../core/useLatest'

import type { ColumnFilterValue } from '../../plugins'
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
  loadManagers,
  makeFilteringData,
  makeOptionFilteringData,
  type OptionFilteringItem,
  optionFilteringColumns,
} from '../__mocks__/filteringData'
import {
  CallbackLog,
  WithLog,
  describeEvent,
  useCallbackLog,
} from './CallbackLog'

export interface FilteringServerDemoProps extends StoryProps {
  /** Время ответа «сервера», мс. */
  serverDelayMs?: number
}

const TOTAL_ROWS = 200
const SERVER_DATA = makeFilteringData(TOTAL_ROWS)

type Filters = { id: string; value: unknown }[]

/** «Сервер»: те же условия, что у клиентского режима; поиск — по колонкам грида (ADR 0053). */
const query = (
  filters: Filters,
  search: string,
  columnIds: string[],
): FilteringItem[] => {
  const needle = normalizeSearch(search)
  return SERVER_DATA.filter(
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
}

export const FilteringServerDemo = ({
  serverDelayMs = 600,
  ...args
}: FilteringServerDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [rows, setRows] = useState(SERVER_DATA)
  const [loading, setLoading] = useState(false)
  const request = useRef({
    filters: [] as Filters,
    search: '',
    columnIds: [] as string[],
    seq: 0,
  })
  const delay = useLatest(serverDelayMs)

  const refetch = useCallback(() => {
    const seq = ++request.current.seq
    setLoading(true)
    window.setTimeout(() => {
      if (seq !== request.current.seq) return
      const { filters, search, columnIds } = request.current
      const result = query(filters, search, columnIds)
      log('server', `${result.length} of ${TOTAL_ROWS} rows`)
      setRows(result)
      setLoading(false)
    }, delay.current)
  }, [log, delay])

  const onFilterChange = useCallback(
    (filters: Filters) => {
      log('onFilterChange', describeEvent({ filters: JSON.stringify(filters) }))
      request.current.filters = filters
      refetch()
    },
    [log, refetch],
  )
  const onSearchChange = useCallback(
    (search: string, { columnIds }: { columnIds: string[] }) => {
      log(
        'onSearchChange',
        describeEvent({ search, columnIds: columnIds.join(',') }),
      )
      request.current.search = search
      request.current.columnIds = columnIds
      refetch()
    },
    [log, refetch],
  )

  return (
    <WithLog log={<CallbackLog entries={entries} onClear={clear} />}>
      <StoryComponent
        {...args}
        columnsOverride={filteringColumns}
        dataOverride={rows}
        enableLoading={loading}
        enableColumnFiltering
        enableQuickSearch
        columnFilteringOptions={{
          server: true,
          filteredCount: true,
          onFilterChange,
          filteredRowCount: rows.length,
          totalRowCount: TOTAL_ROWS,
        }}
        quickSearchOptions={{ server: true, onSearchChange }}
      />
    </WithLog>
  )
}

const OPTION_TOTAL = 200
const OPTION_SERVER_DATA = makeOptionFilteringData(OPTION_TOTAL)

/** «Сервер» фильтра вариантов: те же условия, что у клиентского режима. */
const queryOptions = (filters: Filters): OptionFilteringItem[] =>
  OPTION_SERVER_DATA.filter(row =>
    filters.every(({ id, value }) => {
      const def = optionFilteringColumns.find(column => column.id === id) as
        { filter?: Parameters<typeof filterTypeOf>[0] } | undefined
      const type = filterTypeOf(def?.filter)
      return (
        !type ||
        matchesColumnFilter(
          type,
          row[id as keyof OptionFilteringItem],
          value as ColumnFilterValue,
        )
      )
    }),
  )

/**
 * Демо справочника (ADR 0048, §5): поиск в панели «Manager» зовёт `loadOptions` с
 * задержкой (журнал), фильтры уходят в `onFilterChange`, «сервер» отвечает строками.
 */
export const FilteringLookupServerDemo = ({
  serverDelayMs = 400,
  ...args
}: FilteringServerDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [rows, setRows] = useState(OPTION_SERVER_DATA)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const delay = useLatest(serverDelayMs)

  const columns = useMemo(
    () =>
      optionFilteringColumns.map(column =>
        column.id === 'managerId'
          ? {
              ...column,
              filter: {
                type: 'lookup',
                loadOptions: (
                  search: string,
                  context: { signal: AbortSignal },
                ) => {
                  log('loadOptions', describeEvent({ search }))
                  return loadManagers(search, context, delay.current)
                },
              },
            }
          : column,
      ),
    [log, delay],
  )

  const onFilterChange = useCallback(
    (filters: Filters) => {
      log('onFilterChange', describeEvent({ filters: JSON.stringify(filters) }))
      const current = ++seq.current
      setLoading(true)
      window.setTimeout(() => {
        if (current !== seq.current) return
        const result = queryOptions(filters)
        log('server', `${result.length} of ${OPTION_TOTAL} rows`)
        setRows(result)
        setLoading(false)
      }, delay.current)
    },
    [log, delay],
  )

  return (
    <WithLog log={<CallbackLog entries={entries} onClear={clear} />}>
      <StoryComponent
        {...args}
        columnsOverride={columns as never}
        dataOverride={rows}
        enableLoading={loading}
        enableColumnFiltering
        enableQuickSearch={false}
        columnFilteringOptions={{
          server: true,
          filteredCount: true,
          onFilterChange,
          filteredRowCount: rows.length,
          totalRowCount: OPTION_TOTAL,
        }}
      />
    </WithLog>
  )
}
