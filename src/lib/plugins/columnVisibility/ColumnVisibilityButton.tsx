/**
 * Кнопка «Колонки» в тулбаре (ADR 0035, CV1, CV18). Поповер грузится лениво; пока
 * чанк не пришёл, стоит та же кнопка без Base UI Popover (ADR 0061). Активна, когда
 * скрыта хотя бы одна колонка.
 */
import { Suspense } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useTableState } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { getShowAll, type VisibilityTable } from './columnTree'

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
  const active = getShowAll(table as unknown as VisibilityTable).length > 0

  const placeholder = (
    <ToolbarButton
      label={labels.columns}
      icon={<ColumnsIcon width={18} height={18} />}
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
        active={active}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
      />
    </Suspense>
  )
}
