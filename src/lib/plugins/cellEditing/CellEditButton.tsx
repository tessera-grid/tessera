/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton revealOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEditCell` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Ожидание и отказ сохранения кнопка
 * не показывает — их показывает ячейка (ADR 0177, §1, §5); нажатие после отказа открывает
 * правку с отклонённым значением. Ячейка подписана только на своё состояние.
 */
import { sourceOf } from '../../core/debugActions'
import type { PluginCellProps } from '../../core/definePlugin'
import { useRowDraftMark } from '../../core/drafts/drafts'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { usePredicateResult } from '../../core/renderVersion'
import { CellButton } from '../../ui/CellButton/CellButton'
import { useIcons } from '../../ui/icons'
import { booleanToggle } from './CellEditField'
import { beginEdit } from './editors'
import { EDIT_SESSION_KEY, cellEditingViewOf } from './session'
import type { CellEditingHooks, CellEditingState } from './types'
import { cellEditingLabels } from './labels'

export const CellEditButton = (props: PluginCellProps<CellEditingHooks>) => {
  const { row, column, table, hooks } = props
  const { edit: EditIcon } = useIcons()
  const labels = useLocalization()
  const view = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => cellEditingViewOf(state, row.id, column.id),
  )

  // Ячейки удалённой строки не правятся (ADR 0178, §7).
  const deleted = useRowDraftMark(table, row.id) === 'deleted'
  // Ответы `canEditCell` — перерисовка, только когда они сменились (ADR 0193).
  const editable = usePredicateResult(() => hooks.canEditCell(props))
  const toggles = usePredicateResult(() => booleanToggle(props))

  // Ячейка уже в правке — кнопка не нужна.
  if (view === 'editing' || deleted) {
    return null
  }

  // Предикат из опций гейтит показ по контексту; отправленное сохранение кнопку держит.
  if (!view && !editable) {
    return null
  }

  // Булево с флажком правится нажатием на него: кнопки нет.
  if (toggles) return null
  return (
    <CellButton
      label={cellEditingLabels(labels).editCell}
      icon={<EditIcon width={16} height={16} />}
      onClick={event => beginEdit(table, row, column, hooks, sourceOf(event))}
    />
  )
}
