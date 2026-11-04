/**
 * Дескриптор кнопки фильтра в заголовке (ADR 0045, §4): действие с панелью —
 * инлайн-кнопка и пункт кебаба открывают поповер фильтра колонки. Активный фильтр
 * виден по иконке, признаку `active` и доступному имени.
 */
import { Suspense } from 'react'

import type { HeaderAction } from '../../core/headerActions'
import { preloadable } from '../../core/preloadable'
import { hasColumnFilterDraft } from './filterDraft'
import { useIcons } from '../../ui/icons'
import {
  columnFilterDefOf,
  DEFAULT_FILTER_DEBOUNCE_MS,
  filterTypeOf,
} from '../columnFilteringModel/conditions'

import '../../ui/cellControls/buttonVisibility.css'
import { columnFilteringLabels } from './labels'

const loadFilterPanelModule = () => import('./FilterPanel')

const FilterPanel = preloadable(() =>
  loadFilterPanelModule().then(m => m.FilterPanel),
)

const FilterIcon = ({ active }: { active: boolean }) => {
  const { filter, filterActive } = useIcons()
  const Icon = active ? filterActive : filter
  return <Icon width={16} height={16} />
}

interface FilteringOptions {
  enableColumnFilters?: boolean
  columnFilteringDebounceMs?: number
}

const filterDefOf = (column: unknown) => columnFilterDefOf(column as never)

export const filterHeaderAction: HeaderAction = {
  id: 'columnFiltering',
  slot: 'rightHeaderSlot',
  order: 2,
  visible: ({ column, table }) =>
    (table.options as FilteringOptions).enableColumnFilters !== false &&
    !!filterTypeOf(filterDefOf(column)),
  icon: ({ column }) => <FilterIcon active={column.getIsFiltered()} />,
  label: labels => columnFilteringLabels(labels).filter,
  ariaLabel: ({ column }, labels) =>
    column.getIsFiltered()
      ? columnFilteringLabels(labels).filterActive
      : columnFilteringLabels(labels).filter,
  active: ({ column }) => column.getIsFiltered(),
  // Неприменённое условие колонки (ADR 0178, §3).
  draft: ({ column, table }) => hasColumnFilterDraft(table, column.id),
  className: () => 'column-filter__button',
  // Действие с панелью: выбор открывает поповер, а не вызывает обработчик.
  onSelect: () => {},
  // Поповер открывается сразу с содержимым: панель и модуль её типа грузятся заранее.
  preload: ({ column }) =>
    Promise.all([
      FilterPanel.reload(),
      loadFilterPanelModule().then(m =>
        m.preloadFilterTypePanel(filterTypeOf(filterDefOf(column))),
      ),
    ]),
  panel: ({ column, table }, controls) => (
    <Suspense fallback={null}>
      <FilterPanel.Component
        table={table}
        column={column as never}
        debounceMs={
          (table.options as FilteringOptions).columnFilteringDebounceMs ??
          DEFAULT_FILTER_DEBOUNCE_MS
        }
        controls={controls}
      />
    </Suspense>
  ),
}
