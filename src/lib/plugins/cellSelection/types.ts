/** Опции и типы плагина cellSelection. */

import type {
  CellSelectionModelOptions,
  CellSelectionPredicateCell,
} from '../cellSelectionModel/registry'

export type { CellSelectionPredicateCell }

/** Which pointers show the selection corner handle (ADR 0198). Both by default. */
export interface CellSelectionHandleOptions {
  /** Mouse, touchpad, stylus: a square in the bottom-right corner. */
  mouse?: boolean
  /** Finger: circles in opposite corners. */
  touch?: boolean
  /**
   * What dragging the square does (ADR 0219, §4): `'range'` changes the range, `'fill'` drags
   * values into cells. `'range'` by default; the finger circles always change the range.
   */
  mode?: 'range' | 'fill'
  /** Fill axes. `'xy'` by default. */
  direction?: 'x' | 'y' | 'xy'
  /** Custom value of a fill cell; `ctx.skip` leaves the cell as is. */
  getFillValue?: FillValue
}

/** A fill cell for `getFillValue` (ADR 0219, WR26). */
export interface FillContext {
  /** Source values of the line along the fill axis. */
  values: readonly unknown[]
  /** Number of the fill cell on the line: 0 is the closest to the source. */
  index: number
  direction: 'down' | 'up' | 'right' | 'left'
  rowId: string
  columnId: string
  /** The cell's row. */
  row: unknown
  /** The value by the copy, series or repeat rule. */
  value: unknown
  /** Return it to leave the cell as is. */
  skip: symbol
}

export type FillValue = (ctx: FillContext) => unknown

/**
 * Custom clipboard parsing on paste (ADR 0219, WR3): rows and cells of text, `null` cancels, a
 * promise is a pending state with cancel; `signal` is aborted when the wait is cancelled or a new
 * paste replaces it. `confirm()` asks the user "Paste?" in place of the pending alert: `true`
 * pastes, `false` refuses or cancels.
 */
export type ParseClipboard = (
  clipboard: { text: string; html: string },
  context: { signal: AbortSignal; confirm: () => Promise<boolean> },
) => string[][] | null | PromiseLike<string[][] | null>

export interface CellSelectionOptions extends Omit<
  CellSelectionModelOptions,
  'enabled' | 'canSelectCell'
> {
  /** `false` — the plugin is present but inert (present-but-disabled). */
  enabled?: boolean
  /** Shift extends a rectangular range. `true` by default. */
  rangeSelection?: boolean
  /** Drag to select with the mouse. `true` by default. */
  dragSelection?: boolean
  /** Ctrl/Cmd adds or subtracts a separate rectangle. `true` by default. */
  multiRange?: boolean
  /** Narrows selection; service columns (actions) are never selectable, whatever the predicate. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
  /** Copy doesn't put more selection rows than this into the clipboard. 10,000 by default. */
  maxCopyRows?: number
  /**
   * Corner handle of the active range, used to stretch the range (ADR 0198). `false` — no
   * handle. For mouse and finger by default.
   */
  handle?: false | CellSelectionHandleOptions
  /**
   * Paste from the clipboard, cut and clear of the selection (ADR 0219): they write through the
   * editing plugin. `false` — none of them. `true` by default.
   */
  paste?: boolean
  /** Custom clipboard parsing on paste; takes precedence over the custom format and text. */
  parseClipboard?: ParseClipboard
}
