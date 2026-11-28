import type {
  ServerActionContext,
  ServerActionResult,
} from '../../core/serverActions'

export interface PaginationHooks {
  /**
   * The user changed the page or its size (a button, the size select). A size change returns to
   * the first page: `(0, newSize)`. In server mode a promise is the page request: the grid waits,
   * a rejection returns the previous page (ADR 0116).
   */
  onPageChange: (
    pageIndex: number,
    pageSize: number,
    context: ServerActionContext,
  ) => ServerActionResult
}
