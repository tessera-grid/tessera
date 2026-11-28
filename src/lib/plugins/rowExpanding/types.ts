/** Hook-слайс плагина rowExpanding. */
import type { Row } from '../../types'

export interface RowExpandingHooks {
  /**
   * A row was expanded or collapsed. A promise on expand means pending (lazy loading of
   * descendants): a rejection collapses the row back (ADR 0041).
   */
  onExpandRow: (
    row: Row<any, any>,
    expanded: boolean,
  ) => void | Promise<unknown>
  /** The row has children that aren't in `subRows` (ADR 0054). */
  hasChildren?: (row: Row<any, any>) => boolean
  /**
   * Loads a lazy row's children — on every expand (ADR 0054). An array is shown right away, a
   * promise — after waiting.
   */
  loadChildren?: (
    row: Row<any, any>,
    /** `signal` is aborted when the expand is cancelled (ADR 0153, §1). */
    context?: { signal: AbortSignal },
  ) => readonly unknown[] | PromiseLike<readonly unknown[]>
}
