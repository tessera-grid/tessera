/**
 * Действия ядра в справочнике (ADR 0182, §1): возможности ядра и общие механизмы, которые
 * ядро выполняет от имени плагина (меню, панель, серверный запрос, отмена).
 */
import type { ActionLabels } from '.'

export const CORE_ACTIONS: ActionLabels = {
  moveActiveCell: labels => labels.actionMoveActiveCell,
  enterActionMode: labels => labels.actionEnterActionMode,
  exitActionMode: labels => labels.actionExitActionMode,
  highlight: labels => labels.actionHighlight,
  clearHighlights: labels => labels.actionClearHighlights,
  flashOutcome: labels => labels.actionFlashOutcome,
  scrollToRow: labels => labels.actionScrollToRow,
  scrollToRowIndex: labels => labels.actionScrollToRow,
  resetFilters: labels => labels.actionResetFilters,
  retryLoad: labels => labels.actionRetryLoad,
  dismissLoadError: labels => labels.loadErrorDismiss,
  cancelPending: labels => labels.actionCancelPending,
  cancel: labels => labels.cancel,
  openMenu: labels => labels.actionOpenMenu,
  closeMenu: labels => labels.actionCloseMenu,
  openPanel: labels => labels.actionOpenPanel,
  enterSection: labels => labels.actionEnterSection,
  leaveSection: labels => labels.actionLeaveSection,
  serverRequest: labels => labels.actionServerRequest,
  server: labels => labels.actionServerRequest,
  serverReplaced: labels => labels.actionServerReplaced,
  save: labels => labels.actionSave,
  retry: labels => labels.failureRetry,
  discardChange: labels => labels.failureDiscard,
  sorting: labels => labels.actionSorting,
  filtering: labels => labels.actionFiltering,
  search: labels => labels.actionSearch,
  pagination: labels => labels.actionPage,
  grouping: labels => labels.actionGrouping,
  copy: labels => labels.actionCopy,
}
