/**
 * Счётчик загруженных строк в нижней панели (ADR 0081, `loadedCount`). Не
 * live-область: приход блока объявляет сам хвост ленты.
 */
import type { StatusBarComponentProps } from '../../core/createSlots'
import { knownCount, rowCountOf } from '../../core/dataMode'
import { useLocalization } from '../../core/localization'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { StatusBarCount } from '../../ui/StatusBarCount/StatusBarCount'
import { Skeleton } from '../../ui/Skeleton'

export const LoadedRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  if (isSkeletonShown(table)) {
    return (
      <span data-testid="loaded-rows-count">
        <Skeleton width={80} height="var(--tsr-comp-skeleton-text-height)" />
      </span>
    )
  }
  const rowCount = knownCount(rowCountOf(table))
  const loaded = table.getCoreRowModel().rows.length
  return (
    <StatusBarCount
      data-testid="loaded-rows-count"
      full={
        rowCount === undefined
          ? labels.loadedRows(loaded)
          : labels.loadedRowsOf(loaded, rowCount)
      }
      short={
        rowCount === undefined
          ? labels.loadedRowsShort(loaded)
          : labels.loadedRowsOfShort(loaded, rowCount)
      }
    />
  )
}
