/**
 * Демо панелей (ADR 0046): нижняя панель запрещена (`enableStatusBar: false`), а
 * пагинация работает — переключатель страниц рисует приложение на API таблицы.
 */
import { useTableState } from '../../core/reactivity'
import { useCreateTable } from '../../core/useCreateTable'
import { DataGrid } from '../../grid/DataGrid'
import { pagination } from '../../plugins'
import type { StoryProps } from '../DataGridStory.types'
import { filteringColumns, makeFilteringData } from '../__mocks__/filteringData'

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
