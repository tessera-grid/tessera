/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton showOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEdit` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Слайс «редактируемая ячейка»
 * приходит пропсом `state`, предикат — пропсом `hooks`; импорта плагина нет.
 */
import type { PluginCellStateProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { CellButton } from '../../grid/Actions/CellButton'
import { useIcons } from '../../ui/icons'
import type { CellEditingHooks, EditingCell } from './types'

export const CellEditButton = (
  props: PluginCellStateProps<CellEditingHooks, EditingCell>,
) => {
  const {
    row,
    column,
    state: [editingCell, setEditingCell],
    hooks,
  } = props
  const { edit: EditIcon } = useIcons()
  const labels = useLocalization()
  const key = `${row.id}:${column.id}`

  // Эта ячейка уже редактируется — кнопка не нужна.
  if (editingCell === key) {
    return null
  }

  // Предикат из опций гейтит показ по контексту; false → кнопки нет вовсе.
  if (!hooks.canEdit(props)) {
    return null
  }

  return (
    <CellButton
      title={labels.editCell}
      icon={<EditIcon width={16} height={16} />}
      onClick={() => setEditingCell(key)}
    />
  )
}
