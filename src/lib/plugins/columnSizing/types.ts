/** Hook-слайс плагина columnSizing. */
import type { SessionCancelReason } from '../../core/cancelInteraction'

export interface ColumnSizingHooks {
  onColumnResizeEnd: (props: { id: string; width: number }) => void
  /** Ресайз завершился без результата (ADR 0040, §1). */
  onColumnResizeCancel?: (end: {
    columnId: string
    reason: SessionCancelReason
  }) => void
}
