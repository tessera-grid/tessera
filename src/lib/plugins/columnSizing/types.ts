/** Hook-слайс плагина columnSizing. */
import type { SessionCancelReason } from '../../core/cancelInteraction'

export interface ColumnSizingHooks {
  onColumnResizeEnd: (props: { id: string; width: number }) => void
  /** The resize ended without a result (ADR 0040, §1). */
  onColumnResizeCancel?: (end: {
    columnId: string
    reason: SessionCancelReason
  }) => void
}
