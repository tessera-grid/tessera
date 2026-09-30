/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton showOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEdit` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot), как и пока сохранение ждёт
 * сервера. Ячейка подписана только на своё состояние, а не на весь срез.
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { CellButton } from '../../grid/Actions/CellButton'
import { useIcons } from '../../ui/icons'
import {
  EDIT_SESSION_KEY,
  cellEditingViewOf,
  startEditSession,
} from './session'
import type { CellEditingHooks, CellEditingState } from './types'

export const CellEditButton = (props: PluginCellProps<CellEditingHooks>) => {
  const { row, column, table, hooks } = props
  const { edit: EditIcon } = useIcons()
  const labels = useLocalization()
  const view = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => cellEditingViewOf(state, row.id, column.id),
  )

  // Ячейка уже в правке или ждёт сервера — кнопка не нужна.
  if (view === 'editing' || (view && view.status === 'pending')) {
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
