/**
 * Правый слот ячейки. Кнопка редактирования появляется по hover и не занимает места
 * без него (`CellButton showOnHover`), а показ гейтит предикат `canEdit` по контексту
 * ячейки. В режиме редактирования — инлайн-ввод. Слайс «редактируемая ячейка» приходит
 * пропсом `state`, бизнес-колбэки/предикат — пропсом `hooks`; импорта плагина нет.
 */
import type { PluginCellStateProps } from '../../core/definePlugin'
import { CellButton } from '../../grid/Actions/CellButton'
import { useIcons } from '../../ui/icons'
import { CellEditInput } from './CellEditInput'
import type { CellEditingHooks, EditingCell } from './types'

export const CellEditControl = (
  props: PluginCellStateProps<CellEditingHooks, EditingCell>,
) => {
  const {
    row,
    column,
    state: [editingCell, setEditingCell],
    hooks,
  } = props
  const { edit: EditIcon } = useIcons()
  const key = `${row.id}:${column.id}`

  if (editingCell === key) {
    return (
      <CellEditInput
        initialValue={String(row.getValue(column.id) ?? '')}
        onCommit={value => {
          hooks.onCellEdit({ rowId: row.id, columnId: column.id, value })
          setEditingCell(null)
        }}
        onCancel={() => setEditingCell(null)}
      />
    )
  }

  // Требование: предикат из опций гейтит показ по контексту ячейки; false → кнопки
  // нет вовсе (значит и места она не занимает).
  if (!hooks.canEdit(props)) {
    return null
  }

  // Кнопка живёт в правом слоте, появляется по hover и без hover места не занимает
  // (CellButton showOnHover → класс cell__button--hidden).
  return (
    <CellButton
      title="Edit cell"
      icon={<EditIcon width={16} height={16} />}
      onClick={() => setEditingCell(key)}
    />
  )
}
