/**
 * Фаза B — v9-ядро сборки таблицы (аналог src/lib/core/createTable/useCreateTable).
 *
 * Отличия от v8-версии:
 *  - `useReactTable` → `useTable`;
 *  - `_features: [...]` → `features: buildTesseraFeatures(plugins)` (presence-based);
 *  - row-модели (`getCoreRowModel`/`getSortedRowModel`/…) НЕ передаются опциями —
 *    ядровая модель включается автоматически, остальные приходят слотами из записей;
 *  - `hooks`/`slots`/… — опции always-on `commonFeature`, а не глобальные дженерики.
 *
 * На этом этапе хук проверяется компиляцией; в реальный `<DataGrid>` он
 * подключается на cutover.
 */
import { useEffect, useMemo } from 'react'

import { useTable } from '@tanstack/table-v9'

import type { ColumnDef, RowData, TableOptions, TableState } from '../types'
import type { CommonHooks } from './commonFeature.types'
import { injectServiceColumns } from './createColumns'
import {
  buildTesseraFeatures,
  foldEntries,
  type TesseraFeatureEntry,
  type TesseraFeatures,
} from './features'

export interface UseCreateTableParams<
  TData extends RowData,
  TEntries extends readonly TesseraFeatureEntry[],
> {
  columns: ColumnDef<TesseraFeatures<TEntries>, TData, unknown>[]
  data: TData[]
  plugins?: TEntries

  getRowId?: (row: TData) => string
  state?: Partial<TableState<TesseraFeatures<TEntries>>>

  // Бизнес-контракт хуков (опция always-on commonFeature). Слоты/действия/меню
  // приходят из деклараций плагинов (foldEntries), не из параметров.
  hooks?: CommonHooks
  enableSkeleton?: boolean
  enableLoading?: boolean
  enableFooter?: boolean
}

const DEFAULT_ENTRIES = [] as const

export const useCreateTable = <
  TData extends RowData,
  const TEntries extends readonly TesseraFeatureEntry[],
>({
  columns,
  data,
  plugins = DEFAULT_ENTRIES as unknown as TEntries,
  getRowId,
  state,
  hooks,
  enableSkeleton,
  enableLoading,
  enableFooter,
}: UseCreateTableParams<TData, TEntries>) => {
  // Держим набор фич и свёртку по сигнатуре структуры активных записей (id +
  // enabled), а не по идентичности массива — иначе новый `plugins` пересобирал бы
  // всё каждый рендер (тот же приём, что в v8-ядре).
  const signature = plugins
    .filter(entry => entry.enabled !== false)
    .map(entry => entry.id)
    .join('|')

  const features = useMemo(
    () => buildTesseraFeatures(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  const folded = useMemo(
    () => foldEntries(plugins),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature],
  )

  // Инъекция сервисных колонок плагинов (leading/trailing по order) в набор колонок.
  const injectedColumns = useMemo(
    () => injectServiceColumns(columns, folded.serviceColumns),
    [columns, folded],
  )

  const options = {
    features,
    columns: injectedColumns,
    data,
    getRowId: getRowId ?? ((row: TData) => (row as { id: string }).id),
    state,
    hooks,
    slots: folded.slots,
    slotActions: folded.slotActions,
    actionMenu: folded.actionMenu,
    enableSkeleton,
    enableLoading,
    enableFooter,
    // Табличные опции плагинов (enableSorting и т.п.) — вливаются последними.
    ...folded.options,
  }

  // Каст опций — компромисс динамической сборки (Q2): `tableFeatures()` валидирует
  // слоты в рантайме, но синтетический тип набора не несёт бренд
  // ValidateFeatureSlots и производные опции фич, которых ждёт статическая
  // сигнатура useTable. Каст изолирован здесь; наружу отдаётся строго типизированный
  // ReactTable<TesseraFeatures<TEntries>, TData>.
  const table = useTable(
    options as unknown as TableOptions<TesseraFeatures<TEntries>, TData>,
  )

  // Императивный сетап плагинов (generic-escape ADR 0010) — единым эффектом, чтобы
  // число хуков не зависело от длины набора. Перезапуск при смене структуры набора.
  useEffect(
    () => {
      const cleanups = folded.setups.map(setup => setup(table))
      return () => {
        cleanups.forEach(cleanup => cleanup?.())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- держим по сигнатуре набора
    [signature, table],
  )

  return table
}
