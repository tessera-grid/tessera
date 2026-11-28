/** Подписи `editHistory` (ADR 0182, §8): ключи словаря таблицы `editHistory.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface EditHistoryLabels {
  /** Undo the last edit (ADR 0222, §11). */
  undo: string
  /** Redo an undone edit. */
  redo: string
  /** The "Undo" button and item with the entry's label. */
  undoEntry: (name: string) => string
  /** The "Redo" button and item with the entry's label. */
  redoEntry: (name: string) => string
  /** Go to a history entry — a catalog action. */
  rewind: string
  /** Edit history: the button and the popup title. */
  history: string
  /** Empty history. */
  historyEmpty: string
  /** Explanation of an empty history. */
  historyEmptyDescription: string
  /** Popup footer button: back to the view before the first edit (§11). */
  historyOriginal: string
  /** An undone entry — for screen readers. */
  historyUndone: string
  /** Mark of an entry whose changes are not applied yet (§14). */
  historyUnsaved: string
  /** Hint of the current entry's dot (§11). */
  historyCurrent: string
  historyCurrentUnsaved: string
  /** The "Apply" separator (§14). */
  historyApplied: (count: number) => string
  /** Second line of a popup item for an operation on several cells. */
  historyCells: (count: number) => string
  /** Entry of an operation on several cells (`name` — the action, `count` — cells). */
  entryCells: (name: string, count: number) => string
  /** Entry of an edit of one cell (`name` — the action, `target` — the cell). */
  entryCell: (name: string, target: string) => string
  /** Undo announcement (`name` — the entry). */
  announceUndone: (name: string) => string
  /** Redo announcement. */
  announceRedone: (name: string) => string
  /** Cells changed since then and were skipped (ADR 0222, §6). */
  announceConflicts: (count: number) => string
  /** Cells are no longer in the data — skipped (§7). */
  announceMissing: (count: number) => string
  /** Cells can't be changed right now — the entry stays (§3). */
  announceNotWritable: (count: number) => string
  /** The row was moved again after the move — undo didn't touch it (§13). */
  announceMoveSkipped: string
  /** The entry's cell is hidden by a filter or is on another page (§9). */
  announceHidden: string
  /** Nothing to undo. */
  announceNothing: string
  /** Nothing to redo. */
  announceNothingToRedo: string
}

export const editHistoryLabels = defineLabels<EditHistoryLabels>()(
  'editHistory',
  {
    undo: 'Undo',
    redo: 'Redo',
    undoEntry: 'Undo: {name}',
    redoEntry: 'Redo: {name}',
    rewind: 'Go to change',
    history: 'Change history',
    historyEmpty: 'No changes yet',
    historyEmptyDescription: 'Edits you make in the table will appear here',
    historyOriginal: 'Back to original',
    historyUndone: 'Undone',
    historyUnsaved: 'Not applied',
    historyCurrent: 'Current state',
    historyCurrentUnsaved: 'Current state, not applied',
    historyApplied: 'Applied, {count} changes',
    historyApplied_one: 'Applied, {count} change',
    historyCells: '{count} cells',
    historyCells_one: '{count} cell',
    entryCells: '{name}, {count} cells',
    entryCells_one: '{name}, {count} cell',
    entryCell: '{name}: {target}',
    announceUndone: 'Undone: {name}',
    announceRedone: 'Redone: {name}',
    announceConflicts: '{count} cells changed since — skipped',
    announceConflicts_one: '{count} cell changed since — skipped',
    announceMissing: '{count} cells are no longer in the data — skipped',
    announceMissing_one: '{count} cell is no longer in the data — skipped',
    announceNotWritable: '{count} cells cannot be changed now',
    announceNotWritable_one: '{count} cell cannot be changed now',
    announceMoveSkipped: 'The row was moved again — not undone',
    announceHidden:
      'The changed cells are hidden by the filter or on another page',
    announceNothing: 'Nothing to undo',
    announceNothingToRedo: 'Nothing to redo',
  },
  {
    undoEntry: ['name'],
    redoEntry: ['name'],
    historyCells: ['count'],
    entryCells: ['name', 'count'],
    historyApplied: ['count'],
    entryCell: ['name', 'target'],
    announceUndone: ['name'],
    announceRedone: ['name'],
    announceConflicts: ['count'],
    announceMissing: ['count'],
    announceNotWritable: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    editHistory: typeof editHistoryLabels
  }
}
