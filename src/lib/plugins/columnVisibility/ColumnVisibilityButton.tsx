/**
 * Кнопка «Колонки» в тулбаре (ADR 0035, CV1, CV18). Поповер грузится лениво; пока
 * чанк не пришёл, стоит та же кнопка без Base UI Popover. Активна, когда скрыта
 * хотя бы одна колонка.
 */
import { lazy, Suspense, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { getShowAll, type VisibilityTable } from './columnTree'

const ColumnVisibilityPopover = lazy(() =>
  import('./ColumnVisibilityPopover').then(module => ({
    default: module.ColumnVisibilityPopover,
  })),
)

export const ColumnVisibilityButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { columns: ColumnsIcon } = useIcons()
  const [open, setOpen] = useState(false)

  useTableState(table, state => state.columnVisibility)
  const active = getShowAll(table as unknown as VisibilityTable).length > 0

  return (
    <Suspense
      fallback={
        <ToolbarButton
          label={labels.columns}
          icon={<ColumnsIcon width={18} height={18} />}
          active={active}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="column-visibility-button"
          onClick={() => setOpen(true)}
        />
      }
    >
      <ColumnVisibilityPopover
        table={table}
        active={active}
        open={open}
        onOpenChange={setOpen}
      />
    </Suspense>
  )
}
