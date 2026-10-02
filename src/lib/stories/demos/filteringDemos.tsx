/**
 * Демо фильтрации (ADR 0045): серверный режим с журналом колбэков. Грид не фильтрует
 * сам — фильтры и поиск уходят в `onFilterChange` / `onSearchChange`, «сервер» с
 * задержкой отвечает отфильтрованным набором и числами для «показано N из M».
 */
import { useCallback, useRef, useState } from 'react'

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
  makeFilteringData,
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

/** «Сервер»: те же условия, что у клиентского режима. */
const query = (filters: Filters, search: string): FilteringItem[] => {
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
        [row.name, row.city, row.age, row.visits].some(value =>
          matchesSearch(value, needle),
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
  const request = useRef({ filters: [] as Filters, search: '', seq: 0 })
  const delay = useRef(serverDelayMs)
  delay.current = serverDelayMs

  const refetch = useCallback(() => {
    const seq = ++request.current.seq
    setLoading(true)
    window.setTimeout(() => {
      if (seq !== request.current.seq) return
      const result = query(request.current.filters, request.current.search)
      log('server', `${result.length} of ${TOTAL_ROWS} rows`)
      setRows(result)
      setLoading(false)
    }, delay.current)
  }, [log])

  const onFilterChange = useCallback(
    (filters: Filters) => {
      log('onFilterChange', describeEvent({ filters: JSON.stringify(filters) }))
      request.current.filters = filters
      refetch()
    },
    [log, refetch],
  )
  const onSearchChange = useCallback(
    (search: string) => {
      log('onSearchChange', describeEvent({ search }))
      request.current.search = search
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
        enableToolbar
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
