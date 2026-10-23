/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setDraft`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку. Пока сохранение с промисом
 * ждёт, ячейка показывает отправленное значение, после отказа — значение из данных;
 * ожидание и отказ показывает кнопка правки (ADR 0127, §6). Слой поверх ячейки несёт
 * подсветку сохранения (ADR 0057).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import { useState, type ReactNode } from 'react'

import clsx from 'clsx'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection, useTableState } from '../../core/reactivity'
import { CellEditInput } from './CellEditInput'
import styles from './CellEditInput.module.css'
import {
  EDIT_SESSION_KEY,
  cancelEditSession,
  cellEditingViewOf,
  cellKey,
  commitEditSession,
  endEditSession,
  isEditingCell,
  isUnchangedCommit,
  readEditSession,
  setEditDraft,
  setEditError,
} from './session'
import type { CellEditingHooks, CellEditingState, CellEditor } from './types'

/** Дефолтный редактор: встроенный инлайн-ввод (Enter и потеря фокуса — коммит, Escape — отмена). */
const defaultEditor: CellEditor = ({
  value,
  label,
  error,
  commit,
  cancel,
  setDraft,
}) => (
  <CellEditInput
    initialValue={value}
    label={label}
    error={error}
    onCommit={commit}
    onCancel={cancel}
    onDraftChange={setDraft}
  />
)

export const CellEditField = (
  props: PluginCellProps<CellEditingHooks> & { content: ReactNode },
) => {
  const { row, column, table, content, hooks } = props
  const labels = useLocalization()
  // Подписка только на состояние этой ячейки: ввод черновика другие ячейки не
  // перерисовывает.
  const view = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => cellEditingViewOf(state, row.id, column.id),
  )
  const error = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) =>
      isEditingCell(state.active, row.id, column.id)
        ? state.active!.invalid
        : undefined,
  )

  const submitted = view && view !== 'editing' ? view : null
  const pending = submitted?.status === 'pending'
  const saved = useTableState(
    table as never,
    state =>
      cellKey(row.id, column.id) in
      ((state as { cellSaved?: object }).cellSaved ?? {}),
  ) as boolean
  // Слой появляется с первым сохранением и остаётся до размонтирования: подсветка гаснет
  // на том же элементе.
  const [layer, setLayer] = useState(false)
  if (!layer && saved) {
    setLayer(true)
  }
  const feedback = layer ? (
    <span
      className={clsx('cell-edit-feedback', styles.feedback)}
      aria-hidden="true"
      data-saved={saved || undefined}
    />
  ) : null

  // Сохранение ждёт сервера — отправленное значение; ожидание показывает кнопка правки.
  if (submitted && pending) {
    return (
      <>
        {feedback}
        <span className={styles.pending}>{submitted.draft}</span>
      </>
    )
  }

  // Не в правке или сервер отказал — собственный контент ячейки, то есть значение из
  // данных; черновик отказа ждёт повторной правки, отметка — на кнопке правки.
  if (view !== 'editing') {
    return (
      <>
        {feedback}
        {content}
      </>
    )
  }
  // Правка открыта из «ошибки» — текст отказа, пока `validate` не сказала своё.
  const serverError = readEditSession(table)?.rejected?.error || undefined

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {feedback}
      {editor({
        value: readEditSession(table)?.draft ?? '',
        label: labels.editCellValue(
          typeof column.columnDef.header === 'string'
            ? column.columnDef.header
            : column.id,
        ),
        error: error ?? serverError,
        commit: value => {
          // Потеря фокуса после Enter или Escape: сессия уже закрыта.
          const session = readEditSession(table)
          if (!isEditingCell(session, row.id, column.id)) {
            return
          }
          // Значение не изменилось — просто закрыть правку, без onCellEdit (SS18).
          if (isUnchangedCommit(session, value)) {
            reportAction(table, {
              plugin: 'cellEditing',
              action: 'edit',
              detail: { ...session!.cell, result: 'unchanged' },
              source: sourceOf(globalThis.event),
              phase: 'end',
            })
            endEditSession(table)
            return
          }
          const message = hooks.validate?.(value, props)
          if (message) {
            setEditError(table, message)
            return
          }
          commitEditSession(
            table,
            { rowId: row.id, columnId: column.id },
            value,
            hooks,
          )
        },
        cancel: () => {
          cancelEditSession(table, 'cancel', hooks)
        },
        setDraft: value => setEditDraft(table, value),
        cell: props,
      })}
    </>
  )
}
