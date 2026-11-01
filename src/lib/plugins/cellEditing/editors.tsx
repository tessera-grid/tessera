/**
 * Встроенные редакторы по базовому типу колонки и выбор редактора (ADR 0175, §2–§3):
 * `editor` колонки, затем типа, затем аргумент плагина, затем встроенный. Текст и числа —
 * поле ввода, булево — без поля: действие правки сразу переключает значение.
 */
import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'

import type { DebugActionSource } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { CheckMark } from '../../ui/CheckMark/CheckMark'
import { CellEditInput } from './CellEditInput'
import styles from './CellEditInput.module.css'
import { columnOf } from './editValue'
import { readEditSession, saveEdit, startEditSession } from './session'
import type { CellEditingHooks, CellEditor } from './types'

/** Текст: поле ввода; Enter и потеря фокуса сохраняют, Escape отменяет. */
const textEditor: CellEditor = ({
  text,
  label,
  error,
  commitText,
  cancel,
  setText,
}) => (
  <CellEditInput
    initialValue={text}
    label={label}
    error={error}
    onCommit={commitText}
    onCancel={cancel}
    onDraftChange={setText}
  />
)

/** Число и `numberString`: поле с текстом по языку таблицы (ED4). */
const numberEditor: CellEditor = ({
  text,
  label,
  error,
  commitText,
  cancel,
  setText,
}) => (
  <CellEditInput
    initialValue={text}
    label={label}
    error={error}
    onCommit={commitText}
    onCancel={cancel}
    onDraftChange={setText}
    inputMode="decimal"
  />
)

/**
 * Булево в открытой правке: значок в фокусе, Space и Enter переключают и сохраняют,
 * Escape и потеря фокуса отменяют. Открыта правка, когда сохранение отклонила `validate`
 * или правку открыло приложение (ED5).
 */
const BooleanEdit = ({
  value,
  label,
  error,
  commit,
  cancel,
}: Parameters<CellEditor>[0]) => {
  const labels = useLocalization()
  const errorId = useId()
  const toggle = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    toggle.current?.focus({ preventScroll: true })
  }, [])
  const checked = value === true
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      commit(!checked)
    }
    if (event.key === 'Escape') cancel()
  }
  return (
    <span className={styles.field}>
      <span
        ref={toggle}
        role="checkbox"
        tabIndex={0}
        aria-checked={checked}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={styles.toggle}
        onKeyDown={onKeyDown}
        onClick={() => commit(!checked)}
        onBlur={cancel}
      >
        <CheckMark
          checked={checked}
          label={checked ? labels.booleanTrue : labels.booleanFalse}
        />
      </span>
      <span id={errorId} role="alert" className={styles.error}>
        {error}
      </span>
    </span>
  )
}

const booleanEditor: CellEditor = props => <BooleanEdit {...props} />

interface EditorColumn {
  id: string
  columnDef: { editor?: CellEditor }
}

const columnDefOf = (table: unknown, column: { id: string }) =>
  ((column as Partial<EditorColumn>).columnDef ??
    (columnOf(table, column.id) as Partial<EditorColumn> | undefined)
      ?.columnDef) as EditorColumn['columnDef'] | undefined

/** Редактор ячейки колонки по порядку ED3. */
export const editorOf = (
  table: unknown,
  column: { id: string },
  hooks: Partial<CellEditingHooks>,
): CellEditor => {
  const type = columnOf(table, column.id)?.getDataType()
  const own =
    columnDefOf(table, column)?.editor ??
    type?.definition.editor ??
    hooks.editor
  if (own) return own
  switch (type?.base) {
    case 'boolean':
      return booleanEditor
    case 'number':
    case 'numberString':
      return numberEditor
    default:
      return textEditor
  }
}

/** Булево со встроенным редактором: действие правки переключает значение сразу (ED5). */
export const togglesInPlace = (
  table: unknown,
  column: { id: string },
  hooks: Partial<CellEditingHooks>,
) => editorOf(table, column, hooks) === booleanEditor

/**
 * Начать правку ячейки: булево со встроенным редактором переключается и сохраняется без
 * поля, остальное — открывает редактор.
 */
export const beginEdit = (
  table: unknown,
  row: { id: string; getValue: (columnId: string) => unknown },
  column: { id: string },
  hooks: Partial<CellEditingHooks>,
  source: DebugActionSource,
) => {
  startEditSession(table, row, column, source)
  if (!togglesInPlace(table, column, hooks)) return
  const session = readEditSession(table)
  if (!session) return
  // От значения на начало: правка из отказа повторяет отклонённое значение.
  saveEdit(table, session.cell, { value: session.original !== true }, hooks)
}
