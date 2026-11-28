/** Подписи `cellSelection` (ADR 0182, §8): ключи словаря таблицы `cellSelection.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CellSelectionLabels {
  selectAllCells: string
  /** The "Copy" item (context menu / selection actions) */
  copy: string
  /** Announcement of copying the selection (`cells` is the cell count) */
  announceCopy: (cells: number) => string
  /** Announcement of a pending copy: selection rows are loading (ADR 0146) */
  announceCopyLoading: (rows: number) => string
  /** Copy refused: more selection rows than the `maxCopyRows` limit (ADR 0146) */
  copyTooManyRows: (rows: number, max: number) => string
  /** Copy refused: the browser didn't allow writing to the clipboard (ADR 0146) */
  copyClipboardDenied: string
  /** Action: select cells */
  actionSelect: string
  /** Action: extend the selection */
  actionExtendSelection: string
  /** Action: change the range with the corner handle (ADR 0198) */
  actionResizeRange: string
  /** The "Paste", "Cut", "Clear" items (ADR 0219, WR17) */
  paste: string
  cut: string
  clear: string
  /** Announcement: only part of the clipboard rows was pasted — the table ended (WR8) */
  announcePasteCut: (count: number, total: number) => string
  /** "Paste" from the menu refused: the browser didn't allow reading the clipboard */
  pasteDenied: string
  /** The "Fill down" and "Fill right" items (WR19) */
  fillDown: string
  fillRight: string
  /** Action: drag a value with the handle (WR16) */
  actionFill: string
  /** Write refused in the server row model: more target rows than the `maxCopyRows` limit (ADR 0219, WR28) */
  writeTooManyRows: (rows: number, max: number) => string
}

export const cellSelectionLabels = defineLabels<CellSelectionLabels>()(
  'cellSelection',
  {
    selectAllCells: 'Select all cells',
    copy: 'Copy',
    announceCopy: 'Copied {count} cells',
    announceCopy_one: 'Copied {count} cell',
    announceCopyLoading: 'Copying: loading {count} rows',
    announceCopyLoading_one: 'Copying: loading {count} row',
    copyTooManyRows: 'The limit is {max} rows. Use export',
    copyClipboardDenied: "The browser didn't allow writing to the clipboard",
    actionSelect: 'Select cells',
    actionExtendSelection: 'Extend the selection',
    actionResizeRange: 'Resize the selection',
    paste: 'Paste',
    cut: 'Cut',
    clear: 'Clear',
    announcePasteCut: 'Pasted {count} of {total} rows: the table ended',
    announcePasteCut_one: 'Pasted {count} of {total} rows: the table ended',
    pasteDenied:
      "The browser didn't allow reading the clipboard. Press Ctrl+V or ⌘V",
    fillDown: 'Fill down',
    fillRight: 'Fill right',
    actionFill: 'Fill the cells',
    writeTooManyRows: 'The limit is {max} rows at once',
  },
  {
    announceCopy: ['count'],
    announceCopyLoading: ['count'],
    copyTooManyRows: ['count', 'max'],
    announcePasteCut: ['count', 'total'],
    writeTooManyRows: ['count', 'max'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    cellSelection: typeof cellSelectionLabels
  }
}
