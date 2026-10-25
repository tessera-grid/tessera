/**
 * «Сервер» пагинации для гайда (ADR 0038): сортирует весь набор и отдаёт одну страницу.
 */
import {
  type FilteringItem,
  makeFilteringData,
} from '../__mocks__/filteringData'

export const PAGE_SERVER_TOTAL = 230
const SERVER_DATA = makeFilteringData(PAGE_SERVER_TOTAL)

export type ServerSort = { id: string; desc: boolean } | undefined

const compareValues = (a: unknown, b: unknown) => {
  if (a == null || b == null) {
    return a == null ? (b == null ? 0 : 1) : -1
  }
  return typeof a === 'string'
    ? a.localeCompare(String(b), undefined, { numeric: true })
    : Number(a) - Number(b)
}

/** Строки в порядке `sort`; без сортировки — те же строки. */
export const sortRows = (rows: FilteringItem[], sort: ServerSort) =>
  sort
    ? [...rows].sort((a, b) => {
        const order = compareValues(
          a[sort.id as keyof FilteringItem],
          b[sort.id as keyof FilteringItem],
        )
        return sort.desc ? -order : order
      })
    : rows

/** Ответ «сервера»: страница `pageIndex` по `pageSize` строк в порядке `sort`. */
export const queryPage = (
  pageIndex: number,
  pageSize: number,
  sort: ServerSort,
) =>
  sortRows(SERVER_DATA, sort).slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  )
