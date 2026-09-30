/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setDraft`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку.
 */
import { useState, type ReactNode } from 'react'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { CellEditInput } from './CellEditInput'
import {
  EDIT_SESSION_KEY,
  cancelEditSession,
  endEditSession,
  isEditingCell,
  readEditSession,
  setEditDraft,
} from './session'
import type { CellEditingHooks, CellEditor, EditingCell } from './types'

/** Дефолтный редактор: встроенный инлайн-ввод (Enter — коммит, Escape/blur — отмена). */
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
  const [error, setError] = useState<string>()
  // Подписка только на «редактируется ли эта ячейка»: ввод черновика ячейки не
  // перерисовывает.
  const editing = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (session: EditingCell) => isEditingCell(session, row.id, column.id),
  )

  // Не эта ячейка — отдаём собственный контент ячейки как есть.
  if (!editing) {
    return <>{content}</>
  }

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {editor({
        value: readEditSession(table)?.draft ?? '',
        label: labels.editCellValue(
          typeof column.columnDef.header === 'string'
            ? column.columnDef.header
            : column.id,
        ),
        error,
        commit: value => {
          const message = hooks.validate?.(value, props)
          if (message) {
            setError(message)
            return
          }
          setError(undefined)
          endEditSession(table)
          hooks.onCellEdit({ rowId: row.id, columnId: column.id, value })
        },
        cancel: () => {
          setError(undefined)
          cancelEditSession(table, 'cancel', hooks)
        },
        setDraft: value => setEditDraft(table, value),
        cell: props,
      })}
    </>
  )
}
