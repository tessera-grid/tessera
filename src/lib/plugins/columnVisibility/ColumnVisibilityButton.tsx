/**
 * Кнопка «Колонки» в тулбаре (ADR 0035, CV1, CV18). Поповер грузится лениво; пока
 * чанк не пришёл, стоит та же кнопка без Base UI Popover (ADR 0061). Активна, когда
 * скрыта хотя бы одна колонка; число скрытых — пузырьком на значке (ADR 0062, AI7).
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
import { getShowAll, type VisibilityTable } from './columnTree'

import styles from './ColumnVisibilityMenu.module.css'

const ColumnVisibilityPopover = preloadable(() =>
  import('./ColumnVisibilityPopover').then(
    module => module.ColumnVisibilityPopover,
  ),
)

export const ColumnVisibilityButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { columns: ColumnsIcon } = useIcons()
  const popover = useLazyPopover(
    table,
    ColumnVisibilityPopover,
    all => all.columns,
  )

  useTableState(table, state => state.columnVisibility)
  const hidden = getShowAll(table as unknown as VisibilityTable).length
  const active = hidden > 0
  const label = active ? labels.columnsWithHidden(hidden) : labels.columns
  const icon = (
    <span className={styles.icon}>
      <ColumnsIcon width={16} height={16} />
      {active && (
        <Bubble size="sm" tone="active" className={styles.count} aria-hidden>
          {hidden}
        </Bubble>
      )}
    </span>
  )

  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active={active}
      aria-haspopup="dialog"
      data-testid="column-visibility-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ColumnVisibilityPopover.Component
        table={table}
        label={label}
        icon={icon}
        active={active}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
      />
    </Suspense>
  )
}
