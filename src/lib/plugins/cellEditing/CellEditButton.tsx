/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton revealOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEditCell` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Пока сохранение ждёт сервера,
 * кнопка в ожидании, после отказа — с отметкой; нажатие открывает правку с черновиком
 * (ADR 0127, §6). Ячейка подписана только на своё состояние, а не на весь срез.
 */
import { sourceOf } from '../../core/debugActions'
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

  // Ячейка уже в правке — кнопка не нужна.
  if (view === 'editing') {
    return null
  }

  // Предикат из опций гейтит показ по контексту; отправленное сохранение кнопку держит.
  if (!view && !hooks.canEditCell(props)) {
    return null
  }

  const failed = view?.status === 'error'
  return (
    <CellButton
      label={labels.editCell}
      icon={<EditIcon width={16} height={16} />}
      pending={view?.status === 'pending'}
      errorFlash={failed ? view.attempt : undefined}
      failure={
        failed
          ? labels.actionFailedRetry(view.error || labels.saveFailed)
          : undefined
      }
      onClick={event => startEditSession(table, row, column, sourceOf(event))}
    />
  )
}
