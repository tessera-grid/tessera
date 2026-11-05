// OverlayBodyRow: облако перетаскиваемой строки — облачко кита `DragCloud` (ADR 0183, PK21) с
// ручкой, первой ячейкой и счётчиком подстрок; его рисует грид по просьбе плагина перетаскивания
// (ADR 0168, §2).
import { type ReactNode, forwardRef, memo } from 'react'

import { inertProp } from '../core/inertProp'
import { useLocalization } from '../core/localization'
import type { BodyBoundaryProps } from '../core/pluginWrappers'
import { DragCloud } from '../ui/DragCloud/DragCloud'
import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Cell } from '../types'
import { renderCellContent } from './cellContent'

interface OverlayBodyRowProps {
  firstCell: Cell<any, any, unknown>
  withCount?: boolean
  subRowsCount?: number
  /** Ручка облака — от плагина. */
  handle: ReactNode
}

export const OverlayBodyRow = memo(
  forwardRef<HTMLDivElement, OverlayBodyRowProps>(
    ({ firstCell, withCount = false, subRowsCount = 0, handle }, ref) => {
      const labels = useLocalization()
      return (
        <DragCloud
          ref={ref}
          kind="row"
          className="data-grid-body__row"
          count={withCount ? subRowsCount : undefined}
          // Облако — визуальный клон: ни в дереве доступности, ни в фокусе (ADR 0006, D37).
          {...inertProp(true)}
        >
          <CellWrapperContent noPadding>
            {handle}
            <CellWrapperTitle>
              {renderCellContent(firstCell, labels)}
            </CellWrapperTitle>
          </CellWrapperContent>
        </DragCloud>
      )
    },
  ),
)

OverlayBodyRow.displayName = 'OverlayBodyRow'

/** Облако строки для обёртки тела плагина: первая ячейка данных и счётчик подстрок. */
export const renderRowCloud: BodyBoundaryProps['renderCloud'] = (
  row,
  { ref, handle },
) => {
  const firstCell = row
    .getVisibleCells()
    .find(cell => !cell.column.getIsActionsColumn())
  return firstCell ? (
    <OverlayBodyRow
      ref={ref}
      firstCell={firstCell}
      withCount={row.getCanExpand?.() ?? false}
      subRowsCount={row.subRows.length}
      handle={handle}
    />
  ) : null
}
