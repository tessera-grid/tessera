/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск идёт по видимым
 * колонкам: при активном поиске смена видимости пересобирает кэш. Смена пояса дат
 * (`timeZone`, ADR 0047) при активных фильтрах колонок — тоже. Без фильтров и поиска
 * второй проход подряд строки не обходит (ADR 0068). Срез операции, которую выполняет
 * сервер, клиент не применяет (ADR 0169, §1).
 */
import { createFilteredRowModel } from '@tanstack/react-table'

import { dataModeOf } from '../../core/dataMode'
import type { RowData, Table, TableFeatures } from '../../types'
import { skipIdlePasses } from './idleRowModel'

interface Atom {
  get: () => unknown
}

interface FilteringTable {
  atoms: {
    columnVisibility?: Atom
    globalFilter?: Atom
    columnFilters?: { get: () => unknown[] | undefined }
  }
  options: { columnFilteringTimeZone?: string }
  getPreFilteredRowModel: () => unknown
  autoResetPageIndex?: () => void
}

const UNSET = Symbol('unset')
const NO_SLICE: Atom = { get: () => undefined }

/**
 * Таблица, у которой срезы серверных операций пусты. Строки стоковая модель строит по
 * прототипу самой таблицы — ссылка на таблицу у строк прежняя.
 */
const clientViewOf = <T extends object>(table: T): T => {
  const t = table as unknown as FilteringTable
  const atoms = new Proxy(t.atoms, {
    get: (target, key, receiver) => {
      if (
        key === 'columnFilters' &&
        dataModeOf(table, 'filtering') === 'server'
      )
        return NO_SLICE
      if (key === 'globalFilter' && dataModeOf(table, 'search') === 'server')
        return NO_SLICE
      return Reflect.get(target, key, receiver) as unknown
    },
  })
  return new Proxy(table, {
    get: (target, key, receiver) =>
      key === 'atoms' ? atoms : (Reflect.get(target, key, receiver) as unknown),
  })
}

export const createSearchAwareFilteredRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const client = clientViewOf(table)
    const t = client as unknown as FilteringTable
    const { atoms } = t
    let visibility: unknown = UNSET
    let timeZone: unknown = UNSET
    let rowModel = createFilteredRowModel<TFeatures, TData>()(client)
    const searchValue = () => atoms.globalFilter?.get()
    const filtering = () => (atoms.columnFilters?.get()?.length ?? 0) > 0
    const searchAware = () => {
      const next = atoms.columnVisibility?.get()
      const nextTimeZone = t.options.columnFilteringTimeZone
      const searching = !!searchValue()
      const stale =
        (visibility !== UNSET && next !== visibility && searching) ||
        (timeZone !== UNSET && nextTimeZone !== timeZone && filtering())
      visibility = next
      timeZone = nextTimeZone
      if (stale) rowModel = createFilteredRowModel<TFeatures, TData>()(client)
      return rowModel()
    }
    return skipIdlePasses(
      searchAware,
      () => t.getPreFilteredRowModel() as ReturnType<typeof rowModel>,
      () => {
        const search = searchValue()
        return (
          !filtering() &&
          (search === undefined || search === null || search === '')
        )
      },
      () => t.autoResetPageIndex?.(),
    )
  }
