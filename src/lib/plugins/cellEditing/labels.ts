/** Подписи `cellEditing` (ADR 0182, §8): ключи словаря таблицы `cellEditing.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CellEditingLabels {
  /** Date filter (ADR 0047): conditions, presets, time field, month paging */
  time: string
  /** Tooltip and accessible name of the cell edit button (`cellEditing`) */
  editCell: string
  /** Accessible name of the built-in cell editor field (`column` is the column name) */
  editCellValue: (column: string) => string
  /** Edit field error: the input is not a number (ADR 0175, ED4) */
  editInvalidNumber: string
  /** Edit field error: the input doesn't parse into the column type (ADR 0175, ED2) */
  editInvalidValue: string
  /** Why an edit was rejected: the value changed during the edit (ADR 0175, ED22) */
  editConflict: string
  /** Item of a search field that clears the cell value (ADR 0175, ED8) */
  editClear: string
  /** Edit field buttons on touch: save like Enter and cancel like Escape (ADR 0231, §8) */
  editDone: string
  editCancel: string
  /** Option search in the cell editor (ADR 0175, ED19) */
  editSearchOptions: string
  /** Cell editor: no options */
  editNoOptions: string
  /** Cell editor: lookup options are loading */
  editLoadingOptions: string
  /** Cell editor: lookup options failed to load */
  editOptionsError: string
  /** Cell editor: retry loading options */
  editRetry: string
  /** Draft kind of a cell value in the unsaved-changes panel (ADR 0178, §5). */
  cellDraftKind: string
  /** Mark of an unsaved cell value: name and the "was, now" reason. */
  cellDraft: string
  cellDraftReason: (was: string, now: string) => string
  /** Revert an unsaved cell value. */
  cellDraftRollback: string
  /** Rows before saving (ADR 0178, §7): kinds in the panel and revert in the actions column. */
  rowInsertDraftKind: string
  rowDeleteDraftKind: string
  /** Summary of a new row in the panel: the first values and how many more (DR43). */
  rowInsertDraftMore: (values: string, count: number) => string
  rowInsertDiscard: string
  rowDeleteDiscard: string
  /** Announcement that a cell save failed (`column` is the column name) */
  announceSaveFailed: (name: string, target: string, error: string) => string
  /** Action: change the edit draft */
  actionChangeDraft: string
  /** Action: the value failed validation */
  actionValidationFailed: string
  /** Action: toggle a boolean value with a key */
  actionToggle: string
  /** Action: revert a new or removed row */
  actionRowDraftDiscard: string
  /** Cell write actions (ADR 0219, §8) */
  actionPaste: string
  actionCut: string
  actionClear: string
  actionBulkEdit: string
  actionFillDown: string
  actionFillRight: string
  actionWrite: string
  /** Why writing text was refused: it didn't parse for the type or failed validation */
  writeInvalidReason: (reason: string, text: string) => string
  /** Announcement of a write operation (`name` — the action, `count` — cells written) */
  announceWritten: (name: string, count: number) => string
  /** Part of the announcement: read-only cells skipped */
  announceWriteSkipped: (count: number) => string
  /** Part of the announcement: cells with errors */
  announceWriteInvalid: (count: number) => string
  /** Announcement: the operation's batch was saved */
  announceWriteSaved: (name: string) => string
  /** Announcement: the operation's batch was not saved */
  announceWriteFailed: (name: string, error: string) => string
  /** Apply outcome (ADR 0227, §1) — alert and announcement: everything was saved */
  applySaved: (count: number) => string
  /** Apply outcome: part was refused — how many were saved out of the total */
  applyPartly: (saved: number, total: number) => string
  /** Apply outcome: the server refused all edits */
  applyNone: (total: number) => string
  /** Apply outcome: the whole request failed */
  applyFailed: (reason: string) => string
  /** Action of the partial-outcome alert: open the failure log */
  applyShow: string
  /** Action of the partial-outcome alert without a log: apply the unsaved changes again */
  applyRetry: string
}

export const cellEditingLabels = defineLabels<CellEditingLabels>()(
  'cellEditing',
  {
    time: 'Time',
    editCell: 'Edit cell',
    editCellValue: 'Edit {column}',
    editInvalidNumber: 'Enter a number',
    editInvalidValue: 'Invalid value',
    editClear: 'Clear value',
    editDone: 'Done',
    editCancel: 'Cancel editing',
    editConflict: 'The value changed while you were editing — not saved',
    editSearchOptions: 'Search values',
    editNoOptions: 'No values',
    editLoadingOptions: 'Loading…',
    editOptionsError: "Couldn't load values",
    editRetry: 'Retry',
    cellDraftKind: 'Edit',
    cellDraft: 'Unsaved change',
    cellDraftReason: 'Was: {was}. Now: {now}',
    cellDraftRollback: 'Revert',
    rowInsertDraftKind: 'New row',
    rowDeleteDraftKind: 'Deleted row',
    rowInsertDraftMore: '{values} and {count} more',
    rowInsertDiscard: 'Remove row',
    rowDeleteDiscard: 'Restore row',
    announceSaveFailed: '{name}, {target}: {error}',
    actionChangeDraft: 'Change the draft',
    actionValidationFailed: 'Check the value',
    actionToggle: 'Toggle the value',
    actionRowDraftDiscard: 'Revert the row change',
    actionPaste: 'Paste',
    actionCut: 'Cut',
    actionClear: 'Clear cells',
    actionBulkEdit: 'Edit the selection',
    actionFillDown: 'Fill down',
    actionFillRight: 'Fill right',
    actionWrite: 'Write to cells',
    writeInvalidReason: '{reason}: "{text}"',
    announceWritten: '{name}: {count} cells',
    announceWritten_one: '{name}: {count} cell',
    announceWriteSkipped: '{count} read-only skipped',
    announceWriteInvalid: '{count} not recognized',
    announceWriteSaved: '{name}: saved',
    announceWriteFailed: '{name}: not saved. {error}',
    applySaved: 'Saved {count} changes',
    applySaved_one: 'Saved {count} change',
    applyPartly: 'Saved {saved} of {total}',
    applyNone: 'Nothing was saved: 0 of {total}',
    applyFailed: 'Changes were not saved: {reason}',
    applyShow: 'Show',
    applyRetry: 'Retry unsaved',
  },
  {
    editCellValue: ['column'],
    cellDraftReason: ['was', 'now'],
    rowInsertDraftMore: ['values', 'count'],
    announceSaveFailed: ['name', 'target', 'error'],
    writeInvalidReason: ['reason', 'text'],
    announceWritten: ['name', 'count'],
    announceWriteSkipped: ['count'],
    announceWriteInvalid: ['count'],
    announceWriteSaved: ['name'],
    announceWriteFailed: ['name', 'error'],
    applySaved: ['count'],
    applyPartly: ['saved', 'total'],
    applyNone: ['total'],
    applyFailed: ['reason'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    cellEditing: typeof cellEditingLabels
  }
}
