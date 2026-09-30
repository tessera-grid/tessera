/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Слайс «редактируемая ячейка» приходит
 * пропсом `state`, значение/коллбэки — без импорта плагина в потребителя.
 */
import { useEffect, useState } from 'react'

import type { PluginCellOwnerProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { CellEditInput } from './CellEditInput'
import type { CellEditingHooks, CellEditor, EditingCell } from './types'

/** Дефолтный редактор: встроенный инлайн-ввод (Enter — коммит, Escape/blur — отмена). */
const defaultEditor: CellEditor = ({ value, label, error, commit, cancel }) => (
  <CellEditInput
    initialValue={value}
    label={label}
    error={error}
    onCommit={commit}
    onCancel={cancel}
  />
)

export const CellEditField = (
  props: PluginCellOwnerProps<CellEditingHooks, EditingCell>,
) => {
  const {
    row,
    column,
    content,
    state: [editingCell, setEditingCell],
    hooks,
  } = props
  const labels = useLocalization()
  const [error, setError] = useState<string>()
  const key = `${row.id}:${column.id}`
  const editing = editingCell === key
  // Правку запретили на лету (`canEdit`) — редактор закрывается без сохранения
  // (ADR 0039, RX16).
  const allowed = hooks.canEdit(props)
  useEffect(() => {
    if (editing && !allowed) {
      setError(undefined)
      setEditingCell(null)
    }
  }, [editing, allowed, setEditingCell])

  // Не эта ячейка — отдаём собственный контент ячейки как есть.
  if (!editing) {
    return <>{content}</>
  }

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {editor({
        value: String(row.getValue(column.id) ?? ''),
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
          hooks.onCellEdit({ rowId: row.id, columnId: column.id, value })
          setEditingCell(null)
        },
        cancel: () => {
          setError(undefined)
          setEditingCell(null)
        },
        cell: props,
      })}
    </>
  )
}
