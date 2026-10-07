/**
 * Кнопка-сводка фильтров в тулбаре (ADR 0045, §5, FL12–FL13): число активных
 * фильтров бейджем, без фильтров — `disabled`. Поповер грузится лениво; пока чанк
 * не пришёл, стоит та же кнопка без Base UI Popover (ADR 0061).
 */
import { Suspense } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useTableState } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { filterSummaryOf } from './filterSummary'

import styles from './FilterSummary.module.css'

const FilterSummaryPopover = preloadable(() =>
  import('./FilterSummaryPopover').then(module => module.FilterSummaryPopover),
)

export const FilterSummaryButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { filter: FilterIcon } = useIcons()
  useTableState(table, state => [state.columnFilters, state.columnVisibility])
  const items = filterSummaryOf(table)
  const hidden = items.filter(item => item.hidden).length
  const label = labels.filters(items.length, hidden)
  const icon = (
    <span className={styles.icon}>
      <FilterIcon width={18} height={18} />
      {items.length > 0 && (
        <Bubble size="sm" tone="active" className={styles.count} aria-hidden>
          {items.length}
        </Bubble>
      )}
    </span>
  )
  const popover = useLazyPopover(table, FilterSummaryPopover, () => label)
  // Последний фильтр сброшен из сводки — она закрывается вместе с кнопкой.
  const isOpen = popover.open && items.length > 0

  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active={items.length > 0}
      disabled={items.length === 0}
      aria-haspopup="dialog"
      data-testid="filter-summary-button"
      {...popover.trigger}
      aria-expanded={isOpen}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <FilterSummaryPopover.Component
        table={table}
        items={items}
        label={label}
        icon={icon}
        open={isOpen}
        onOpenChange={popover.onOpenChange}
      />
    </Suspense>
  )
}
