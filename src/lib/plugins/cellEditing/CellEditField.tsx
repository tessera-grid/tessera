/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор — `editor` колонки, её типа или плагина, иначе
 * встроенный по базовому типу (ADR 0175, ED3). Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setText`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку. Пока сохранение с промисом
 * ждёт, ячейка показывает отправленное значение, после отказа — значение из данных;
 * ожидание и отказ показывает кнопка правки (ADR 0127, §6), итог на ячейке — вспышка
 * (ADR 0134).
 */
import type { ReactNode } from 'react'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { CheckMark } from '../../ui/CheckMark/CheckMark'
import { editorOf } from './editors'
import styles from './CellEditInput.module.css'
import {
  EDIT_SESSION_KEY,
  cancelEditSession,
  cellEditingViewOf,
  isEditingCell,
  readEditSession,
  saveEdit,
  setEditDraft,
  setEditText,
} from './session'
import type { CellEditingHooks, CellEditingState } from './types'

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
  // Сохранение ждёт сервера — отправленное значение; ожидание показывает кнопка правки.
  if (submitted && pending) {
    return (
      <span className={styles.pending}>
        {typeof submitted.draft === 'boolean' &&
        column.getDataType()?.base === 'boolean' ? (
          <CheckMark
            checked={submitted.draft}
            label={submitted.draft ? labels.booleanTrue : labels.booleanFalse}
          />
        ) : (
          submitted.text
        )}
      </span>
    )
  }

  // Не в правке или сервер отказал — собственный контент ячейки, то есть значение из
  // данных; черновик отказа ждёт повторной правки, отметка — на кнопке правки.
  if (view !== 'editing') {
    return content
  }
  const session = readEditSession(table)
  // Правка открыта из «ошибки» — текст отказа, пока `validate` не сказала своё.
  const serverError = session?.rejected?.error || undefined
  const cell = { rowId: row.id, columnId: column.id }

  // Режим правки: контент замещается редактором колонки, типа, плагина или встроенным.
  return editorOf(
    table,
    column,
    hooks,
  )({
    value: session?.draft,
    text: session?.text ?? '',
    label: labels.editCellValue(
      typeof column.columnDef.header === 'string'
        ? column.columnDef.header
        : column.id,
    ),
    error: error ?? serverError,
    commit: value => saveEdit(table, cell, { value }, hooks, props),
    commitText: text => saveEdit(table, cell, { text }, hooks, props),
    // Уход фокуса из редактора после открытия правки другой ячейки её не отменяет.
    cancel: () => {
      if (isEditingCell(readEditSession(table), row.id, column.id))
        cancelEditSession(table, 'cancel', hooks)
    },
    setDraft: value => setEditDraft(table, value),
    setText: text => setEditText(table, text),
    cell: props,
  })
}
