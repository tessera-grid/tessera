/** Локальное состояние и хуки плагина cellEditing. */
import type { ReactNode } from 'react'

import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellWriteSource } from '../../core/cellWrites'
import type { CellEditHook } from '../../shared/cellHooks'

/**
 * An edit session (ADR 0040, §2): the cell, the draft and the value at the start. It lives in
 * the plugin's slice and survives the editor unmounting.
 */
export interface EditSession {
  cell: { rowId: string; columnId: string }
  /**
   * Draft in the column type (ADR 0175, §1); `undefined` — the typed text doesn't parse into
   * the type.
   */
  draft: unknown
  /** Draft as text: what's typed in the field; at the start — the value in the table's language. */
  text: string
  /** Cell value at the start of the edit. */
  original: unknown
  /** The edit was opened from an error: the server's refusal text (ADR 0041). */
  rejected?: { error: string }
  /** Error text of the last save: `validate` or type parsing. */
  invalid?: string
}

/** The active edit session or null. */
export type EditingCell = EditSession | null

/**
 * A submitted cell (ADR 0041, §2): the save waits for the `onCellEdit` promise or was rejected.
 * Separate from the active edit — other cells can be edited right away.
 */
export interface SubmittedCell {
  rowId: string
  columnId: string
  /** The submitted value in the column type. */
  draft: unknown
  /** The submitted value as text. */
  text: string
  original: unknown
  status: 'pending' | 'error'
  /** The server's refusal text (for `error`). */
  error?: string
  /** Submission number: a late result of an earlier submission is ignored. */
  attempt: number
  /** The apply or write operation in which the refusal arrived (ADR 0227, §3). */
  batch?: string
}

/**
 * Outcome of the last draft apply (ADR 0227, §1): the alert follows it. A new apply replaces
 * the entry.
 */
export interface ApplyOutcome {
  /** Apply id — the same `batch` as on its failures. */
  id: string
  /** Cell and row edits saved. */
  saved: number
  /** Not saved. */
  refused: number
  /** The whole request failed: the reason; `refused` — all edits of the apply. */
  failed?: { reason: string }
  /**
   * Applies the unsaved changes again in one `onCommitEdits` call: after a whole-request failure —
   * the same set, otherwise the refused ones. Nothing to retry — no field.
   */
  retry?: () => void
}

/**
 * A write operation batch waiting for an answer (ADR 0219, §10): one entry per batch with a map
 * of cells by cell key, so a pending change doesn't rewrite the slice entry per cell.
 */
export interface PendingPackage {
  id: string
  cells: ReadonlyMap<string, SubmittedCell>
}

/** The plugin's slice: the active edit, submitted cells by cell key, and pending batches. */
export interface CellEditingState {
  active: EditingCell
  submitted: Record<string, SubmittedCell>
  packages?: Readonly<Record<string, PendingPackage>>
  /** Outcome of the last draft apply, until the alert is closed (ADR 0227, §1). */
  applied?: ApplyOutcome
}

/** Data for committing a new cell value. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  /** New value in the column type: a number, `Date`, record, array (ADR 0175, ED1). */
  value: unknown
  /** The typed text; for an editor without a field — the value's text in the table's language. */
  text: string
  /** Cell value at the start of the edit. */
  original: unknown
  /** The current value — present only if it changed from outside during the edit. */
  current?: unknown
}

/** Why an edit ended without saving (ADR 0040, §1). */
export type EditCancelReason = SessionCancelReason | 'conflict'

/** Data of an edit that ended without saving. */
export interface CellEditCancel {
  rowId: string
  columnId: string
  reason: EditCancelReason
  /** Draft in the column type — never lost silently; `undefined` — the text doesn't parse. */
  draft: unknown
  /** Draft as text. */
  text: string
  /** Cell value at the start of the edit. */
  original: unknown
  /** The current value — for `conflict`. */
  current?: unknown
  /** The server's refusal text — the draft was rejected (ADR 0041). */
  error?: string
}

/** What a cell editor receives (ADR 0175, §3). */
export interface CellEditorProps {
  /** Draft in the column type: at the start — the cell value; survives scrolling. */
  value: unknown
  /** Draft as text: at the start — the value in the table's language. */
  text: string
  /** Accessible name of the field (`localization.editCellValue` with the column name). */
  label: string
  /** Error text from `validate` or parsing; the field gets `aria-invalid` and the linked error text. */
  error?: string
  /** Saves a value in the column type. */
  commit: (value: unknown) => void
  /** Saves the typed text: the column type parses it; if it doesn't parse — a field error. */
  commitText: (text: string) => void
  cancel: () => void
  /** Reports a draft in the column type: it lives in the slice and goes to `onEditCancel`. */
  setDraft: (value: unknown) => void
  /** Reports the typed text. */
  setText: (text: string) => void
  cell: CellComponentProps
}

/**
 * Renders a cell editor (bring your own, with your design system). When the column, its type
 * and the plugin don't set one — the built-in editor for the column's base type.
 */
export type CellEditor = (props: CellEditorProps) => ReactNode

/** An edit of one cell in a save batch (ADR 0178, §5). */
export interface CellEditBatchItem {
  rowId: string
  columnId: string
  /** Value in the column type. */
  value: unknown
  /** The typed text. */
  text: string
  /** The value currently in the data. */
  original: unknown
}

/** A new row in the batch (ADR 0178, §7): a temporary id, values and a place. */
export interface RowInsertBatchItem {
  /** Temporary id: the answer returns the saved row and failures by it. */
  rowId: string
  values: Record<string, unknown>
  /** Place in the visible list. */
  index: number
  /** The row above the new one; none — the new row is first. */
  after?: string
}

/** A save batch: cell edits, new and removed rows. */
export interface CellEditBatch {
  /** Id of the cell write operation — a paste, clear, bulk edit (ADR 0219, §6). */
  id?: string
  /** Where the operation came from; none — "Apply" of drafts (ADR 0178). */
  source?: CellWriteSource
  cells: readonly CellEditBatchItem[]
  inserts?: readonly RowInsertBatchItem[]
  deletes?: readonly { rowId: string }[]
}

/**
 * Answer to a batch: refusals with a reason — per cell or, without `columnId`, per row; the rest
 * is saved. `saved` — saved new rows by temporary id.
 */
export interface CellEditBatchResult {
  refused?: readonly { rowId: string; columnId?: string; reason: string }[]
  saved?: readonly { rowId: string; row: unknown }[]
}

/** `canEditCell` — whether to show the edit button for a cell context. */
export interface CellEditingHooks extends CellEditHook {
  /**
   * Commits a new cell value. A promise is a save with a pending state: the cell waits for its
   * outcome without blocking edits of other cells (ADR 0041). A saved row in the answer — right
   * away or as a promise — goes into the server row model cache (ADR 0139). `signal` is aborted
   * when the user cancels the pending save (ADR 0177, §8).
   */
  onCellEdit: (
    commit: CellEditCommit,
    context: { signal: AbortSignal },
  ) => object | void | Promise<unknown>
  /** The edit ended without saving: Escape, or disallowed on the fly (ADR 0040). */
  onEditCancel?: (end: CellEditCancel) => void
  /**
   * Saving (ADR 0178, §5): `'auto'` (default) — a finished edit goes to `onCellEdit`;
   * `'manual'` — it becomes a cell draft, saved by the `onCommitEdits` batch.
   */
  saveMode?: 'auto' | 'manual'
  /**
   * Saves a batch of drafts in one call. A promise shows pending on the batch's cells; the answer
   * may refuse some cells (`refused`) — they get a failure on the object, the draft stays.
   */
  onCommitEdits?: (
    batch: CellEditBatch,
    context: { signal: AbortSignal },
  ) => CellEditBatchResult | void | PromiseLike<CellEditBatchResult | void>
  /**
   * The value changed from outside during the edit: `'commit'` (default) — save and pass
   * `original`/`current` to `onCellEdit`; `'block'` — don't save, end with `conflict`.
   */
  onConflict?: 'commit' | 'block'
  /** Typing pause before the lookup request in the options editor, ms (ADR 0175, ED18). */
  searchDebounceMs?: number
  /** Default cell editor; the column's and its type's `editor` take precedence (ADR 0175, ED3). */
  editor?: CellEditor
  /**
   * Error text for a value, or `null`/`undefined` if it's valid. The value is in the column
   * type, `text` is the typed text.
   */
  validate?: (
    value: unknown,
    ctx: CellComponentProps,
    text: string,
  ) => string | null | undefined
}

/* eslint-disable @typescript-eslint/no-unused-vars -- параметр типа обязан повторять
   объявление, иначе declaration merging не склеится */
declare module '../../core/dataTypes' {
  interface DataTypeFields<TData> {
    /** Cell editor of the column or type; takes precedence over the plugin's `editor` argument (ADR 0175, ED3). */
    editor?: CellEditor
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
