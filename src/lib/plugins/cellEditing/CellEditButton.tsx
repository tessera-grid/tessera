/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (`CellButton revealOnHover` → класс cell__button--hidden). Показ
 * гейтит предикат `canEditCell` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Пока сохранение ждёт сервера,
 * кнопка в ожидании, после отказа — с отметкой; нажатие открывает правку с черновиком
 * (ADR 0127, §6). Ячейка подписана только на своё состояние, а не на весь срез.
 */
import { sourceOf } from '../../core/debugActions'
import { readPluginHooks, type PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { CellButton } from '../../ui/CellButton/CellButton'
import { CellInvalid } from '../../ui/cellControls/CellInvalid'
import { useIcons } from '../../ui/icons'
import { beginEdit } from './editors'
import { EDIT_SESSION_KEY, cellEditingViewOf } from './session'
import type { CellErrorHook } from '../../shared/cellHooks'
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

  // Отказ сохранения — первым; без него точка показывает ошибку `cellErrors` (ADR 0150, §3).
  const failure =
    view?.status === 'error'
      ? labels.actionFailedRetry(view.error || labels.saveFailed)
      : readPluginHooks<Partial<CellErrorHook>>(
          table as never,
          'cellErrors',
        ).getCellError?.(props)
  return (
    <>
      {failure !== undefined && <CellInvalid />}
      <CellButton
        label={labels.editCell}
        icon={<EditIcon width={16} height={16} />}
        pending={view?.status === 'pending'}
        failure={failure}
        onClick={event => beginEdit(table, row, column, hooks, sourceOf(event))}
      />
    </>
  )
}
