/** Подписи `failureLog` (ADR 0182, §8): ключи словаря таблицы `failureLog.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface FailureLogLabels {
  /** Failure log: the popover title (ADR 0177, §7). */
  failureLog: string
  /** Empty failure log. */
  failureLogEmpty: string
  /** Explanation of an empty failure log. */
  failureLogEmptyDescription: string
  /** Failure log button with the number of entries. */
  failureLogButton: (count: number) => string
  /** Dismiss all log entries when none of them has an edit (ADR 0227, §6). */
  failureClearAll: string
  /** Discard the edits of all entries and dismiss the rest (ADR 0227, §6). */
  failureDiscardAll: string
  /** The question before discarding all edits: their number. */
  failureDiscardAllQuestion: (count: number) => string
  /** Question buttons: discard and keep the edits. */
  failureDiscardAllConfirm: string
  failureDiscardAllDecline: string
  /** Log group: discard its edits (ADR 0227, §4). */
  failureDiscardGroup: string
  /** Log group: dismiss its entries without edits. */
  failureCloseGroup: string
  /** Number of the group's targets: cells, rows, other objects. */
  failureGroupCells: (count: number) => string
  failureGroupRows: (count: number) => string
  failureGroupItems: (count: number) => string
  /** Log entry: scroll to the target. */
  failureShow: string
  /** Log entry: dismiss it. */
  failureClose: string
  /** Scrolling to the entry's target failed (ADR 0227, §7). */
  targetNotFound: string
  /** Announcement of a new log entry: the number of entries. */
  announceFailureLogged: (count: number) => string
  /** Hint of an entry's dot (ADR 0224). */
  markHint: string
}

export const failureLogLabels = defineLabels<FailureLogLabels>()(
  'failureLog',
  {
    failureLog: 'Error log',
    failureLogEmpty: 'No errors',
    failureLogEmptyDescription:
      'Actions refused by the server will appear here',
    failureLogButton: 'Errors: {count}',
    failureClearAll: 'Close all',
    failureDiscardAll: 'Revert all changes',
    failureDiscardAllQuestion: 'Revert {count} changes?',
    failureDiscardAllQuestion_one: 'Revert {count} change?',
    failureDiscardAllConfirm: 'Revert',
    failureDiscardAllDecline: 'Keep changes',
    failureDiscardGroup: 'Revert changes',
    failureCloseGroup: 'Close all in the group',
    failureGroupCells: '{count} cells',
    failureGroupCells_one: '{count} cell',
    failureGroupRows: '{count} rows',
    failureGroupRows_one: '{count} row',
    failureGroupItems: '{count} errors',
    failureGroupItems_one: '{count} error',
    failureShow: 'Show',
    failureClose: 'Close',
    targetNotFound: "Couldn't find the row",
    announceFailureLogged: 'Errors in the log: {count}',
    markHint: 'Not done',
  },
  {
    failureLogButton: ['count'],
    failureDiscardAllQuestion: ['count'],
    failureGroupCells: ['count'],
    failureGroupRows: ['count'],
    failureGroupItems: ['count'],
    announceFailureLogged: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    failureLog: typeof failureLogLabels
  }
}
