/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton showOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEdit` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Ячейка подписана только на
 * «редактируется ли она», а не на всю сессию.
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { CellButton } from '../../grid/Actions/CellButton'
import { useIcons } from '../../ui/icons'
import { EDIT_SESSION_KEY, isEditingCell, startEditSession } from './session'
import type { CellEditingHooks, EditingCell } from './types'

export const CellEditButton = (props: PluginCellProps<CellEditingHooks>) => {
  const { row, column, table, hooks } = props
  const { edit: EditIcon } = useIcons()
  const labels = useLocalization()
  const editing = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (session: EditingCell) => isEditingCell(session, row.id, column.id),
  )

  // Эта ячейка уже редактируется — кнопка не нужна.
  if (editing) {
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
      onClick={() => startEditSession(table, row, column)}
    />
  )
}
