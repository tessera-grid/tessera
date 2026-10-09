/**
 * Счётчик загруженных строк в нижней панели (ADR 0081, `loadedCount`). Не
 * live-область: приход блока объявляет сам хвост ленты.
 */
import type { StatusBarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { StatusBarCount } from '../../grid/StatusBar/StatusBarCount'
import { Skeleton } from '../../ui/Skeleton'

export const LoadedRowsCount = ({ table }: StatusBarComponentProps) => {
  const labels = useLocalization()
  if (isSkeletonShown(table)) {
    return (
      <span data-testid="loaded-rows-count">
        <Skeleton width={80} height={14} />
      </span>
    )
  }
  const rowCount = (table.options as { infiniteScrollRowCount?: number })
    .infiniteScrollRowCount
  const loaded = table.getCoreRowModel().rows.length
  return (
    <StatusBarCount
      data-testid="loaded-rows-count"
      full={labels.loadedRows(loaded, rowCount)}
      short={labels.loadedRowsShort(loaded, rowCount)}
    />
  )
}
