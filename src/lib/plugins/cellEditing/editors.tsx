/**
 * Встроенные редакторы по базовому типу колонки и выбор редактора (ADR 0175, §2–§3):
 * `editor` колонки, затем типа, затем аргумент плагина, затем встроенный. Текст и числа —
 * поле ввода, булево — без поля: действие правки сразу переключает значение, даты —
 * поповер с календарём, варианты — поле с поиском или список с флажками.
 */
import {
  Suspense,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react'

import type { DebugActionSource } from '../../core/debugActions'
import { ignoreBusyChange } from '../../core/failures/failuresFeature'
import { isCellBusy } from '../../shared/objectPending'
import { preloadable } from '../../core/preloadable'
import { Checkbox } from '../../ui/Checkbox/Checkbox'
import { FieldError } from '../../ui/Field/Field'
import { CellEditInput } from './CellEditInput'
import styles from './CellEditInput.module.css'
import { columnOf } from './editValue'
import {
  columnNameOf,
  readEditSession,
  saveEdit,
  startEditSession,
} from './session'
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
 * Булево в открытой правке: флажок кита в фокусе (ADR 0183, PK15), Space и Enter переключают
 * и сохраняют, Escape и потеря фокуса отменяют. Открыта правка, когда сохранение отклонила `validate`
 * или правку открыло приложение (ED5).
 */
const BooleanEdit = ({
  value,
  label,
  error,
  commit,
  cancel,
}: Parameters<CellEditor>[0]) => {
  const errorId = useId()
  const toggle = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    toggle.current?.focus({ preventScroll: true })
  }, [])
  const checked = value === true
  // Space переключает сам флажок (Base UI), Enter — здесь: флажок Enter не переключает.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(!checked)
    }
    if (event.key === 'Escape') cancel()
  }
  return (
    <span className={styles.field}>
      <Checkbox
        ref={toggle}
        checked={checked}
        label={label}
        invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onCheckedChange={commit}
        onKeyDown={onKeyDown}
        onBlur={cancel}
      />
      <FieldError id={errorId} role="alert" compact className={styles.error}>
        {error}
      </FieldError>
    </span>
  )
}

const booleanEditor: CellEditor = props => <BooleanEdit {...props} />

// Календарь — отдельный ленивый модуль: грузится при первой правке даты (ED7).
const DateEditor = preloadable(() =>
  import('./DateEditor').then(module => module.DateEditor),
)

/** Даты: поповер с календарём; пока модуль грузится, в ячейке — значение. */
const dateEditor: CellEditor = props => (
  <Suspense fallback={<span className={styles.pending}>{props.text}</span>}>
    <DateEditor.Component {...props} />
  </Suspense>
)

// Варианты — свой ленивый модуль: поле с поиском и список с флажками (ED8–ED9).
const SelectEditor = preloadable(() =>
  import('./OptionEditors').then(module => module.SelectEditor),
)
const MultiSelectEditor = preloadable(() =>
  import('./OptionEditors').then(module => module.MultiSelectEditor),
)

const selectEditor: CellEditor = props => (
  <Suspense fallback={<span className={styles.pending}>{props.text}</span>}>
    <SelectEditor.Component {...props} />
  </Suspense>
)

const multiSelectEditor: CellEditor = props => (
  <Suspense fallback={<span className={styles.pending}>{props.text}</span>}>
    <MultiSelectEditor.Component {...props} />
  </Suspense>
)

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
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return dateEditor
    case 'select':
    case 'object':
      return selectEditor
    case 'multiSelect':
      return multiSelectEditor
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
  // Ячейка занята — своим сохранением или действием строки или колонки: изменение не
  // принимается (ADR 0177, OB5, OB6).
  if (isCellBusy(table, row.id, column.id)) {
    ignoreBusyChange(
      table,
      { cell: [row.id, column.id] },
      columnNameOf(table, column.id),
    )
    return
  }
  startEditSession(table, row, column, source)
  if (!togglesInPlace(table, column, hooks)) return
  const session = readEditSession(table)
  if (!session) return
  // От значения на начало: правка из отказа повторяет отклонённое значение.
  saveEdit(table, session.cell, { value: session.original !== true }, hooks)
}
