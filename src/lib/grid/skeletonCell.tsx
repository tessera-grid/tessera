// Содержимое ячейки скелета (ADR 0060, SL18–SL20): одно правило для первой загрузки,
// хвоста ленты, быстрой прокрутки и слота броска.
import type { CommonColumnDef } from '../core/commonFeature.types'
import {
  type SkeletonCellKind,
  getSkeletonBarWidth,
  getSkeletonCellKind,
} from '../core/skeletonOptions'
import { Skeleton } from '../ui/Skeleton'
import type { Column } from '../types'

const CONTROL_SIZE = 'var(--tsr-comp-skeleton-control-size)'
const CELL_HEIGHT = 'var(--tsr-comp-skeleton-cell-height)'

/** Вид ячейки скелета колонки: `columnDef.skeletonCell` или умолчание. */
export const skeletonCellKindOf = (column: Column<any, any, unknown>) =>
  getSkeletonCellKind(
    (column.columnDef as CommonColumnDef).skeletonCell,
    column.getIsActionsColumn(),
  )

/** Полоска длиной по колонке, квадрат контрола или пусто; `wave` — бегущий блик. */
export const renderSkeletonCell = (
  columnId: string,
  kind: SkeletonCellKind,
  wave: boolean,
) => {
  const animation = wave && 'wave'
  if (kind === 'control' || kind === 'toggle') {
    return (
      <Skeleton
        width={CONTROL_SIZE}
        height={CONTROL_SIZE}
        animation={animation}
      />
    )
  }
  if (kind === 'bar') {
    return (
      <Skeleton
        width={`${getSkeletonBarWidth(columnId)}%`}
        height={CELL_HEIGHT}
        animation={animation}
      />
    )
  }
  return null
}
