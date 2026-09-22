/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Слайс «редактируемая ячейка» приходит
 * пропсом `state`, значение/коллбэки — без импорта плагина в потребителя.
 */
import type { PluginCellOwnerProps } from '../../core/definePlugin'
import { CellEditInput } from './CellEditInput'
import type { CellEditingHooks, CellEditor, EditingCell } from './types'

/** Дефолтный редактор: встроенный инлайн-ввод (Enter — коммит, Escape/blur — отмена). */
const defaultEditor: CellEditor = ({ value, commit, cancel }) => (
  <CellEditInput initialValue={value} onCommit={commit} onCancel={cancel} />
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
  const key = `${row.id}:${column.id}`

  // Не эта ячейка — отдаём собственный контент ячейки как есть.
  if (editingCell !== key) {
    return <>{content}</>
  }

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {editor({
        value: String(row.getValue(column.id) ?? ''),
        commit: value => {
          hooks.onCellEdit({ rowId: row.id, columnId: column.id, value })
          setEditingCell(null)
        },
        cancel: () => setEditingCell(null),
        cell: props,
      })}
    </>
  )
}
