/**
 * Кнопка-сводка фильтров в тулбаре (ADR 0045, §5, FL12–FL13): число активных
 * фильтров бейджем, без фильтров — `disabled`. Поповер грузится лениво; пока чанк
 * не пришёл, стоит та же кнопка без Base UI Popover.
 */
import { lazy, Suspense, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { filterSummaryOf } from './filterSummary'

import styles from './FilterSummary.module.css'

const FilterSummaryPopover = lazy(() =>
  import('./FilterSummaryPopover').then(module => ({
    default: module.FilterSummaryPopover,
  })),
)

export const FilterSummaryButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { filter: FilterIcon } = useIcons()
  const [open, setOpen] = useState(false)

  useTableState(table, state => [state.columnFilters, state.columnVisibility])
  const items = filterSummaryOf(table)
  const hidden = items.filter(item => item.hidden).length
  const label = labels.filters(items.length, hidden)
  const icon = (
    <span className={styles.icon}>
      <FilterIcon width={18} height={18} />
      {items.length > 0 && (
        <Bubble size="sm" className={styles.count} aria-hidden>
          {items.length}
        </Bubble>
      )}
    </span>
  )
  // Последний фильтр сброшен из сводки — она закрывается вместе с кнопкой.
  const isOpen = open && items.length > 0

  return (
    <Suspense
      fallback={
        <ToolbarButton
          label={label}
          icon={icon}
          active={items.length > 0}
          disabled={items.length === 0}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          data-testid="filter-summary-button"
          onClick={() => setOpen(true)}
        />
      }
    >
      <FilterSummaryPopover
        table={table}
        items={items}
        label={label}
        icon={icon}
        open={isOpen}
        onOpenChange={setOpen}
      />
    </Suspense>
  )
}
