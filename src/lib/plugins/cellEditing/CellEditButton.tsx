/**
 * Правый слот ячейки: кнопка входа в режим правки. Появляется по hover и без него
 * места не занимает (класс cell__button--hidden). Показ
 * гейтит предикат `canEditCell` по контексту ячейки; в режиме правки этой ячейки кнопки
 * нет (её место занял редактор во владельце cellSlot). Ожидание и отказ сохранения кнопка
 * не показывает — их показывает ячейка (ADR 0177, §1, §5); нажатие после отказа открывает
 * правку с отклонённым значением. Кнопка подписана на свою видимость.
 */
import { memo } from 'react'

import { sourceOf } from '../../core/debugActions'
import type { PluginCellProps } from '../../core/definePlugin'
import { useRowDraftMark } from '../../core/drafts/drafts'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { usePredicateResult } from '../../core/renderVersion'
import { SimpleCellButton } from '../../ui/CellButton/CellButton'
import { useIcons } from '../../ui/icons'
import { booleanToggle } from './CellEditField'
import { beginEdit } from './editors'
import { EDIT_SESSION_KEY, cellEditingViewOf, isEditingCell } from './session'
import type { CellEditingHooks, CellEditingState } from './types'
import { cellEditingLabels } from './labels'

export const CellEditButton = memo(function CellEditButton(
  props: PluginCellProps<CellEditingHooks>,
) {
  const { row, column, table, hooks } = props
  const { edit: EditIcon } = useIcons()
  const labels = useLocalization()
  // Ячейки удалённой строки не правятся (ADR 0178, §7).
  const deleted = useRowDraftMark(table, row.id) === 'deleted'
  // Ответы `canEditCell` — перерисовка, только когда они сменились (ADR 0193).
  const mode = usePredicateResult(() => {
    if (booleanToggle(props)) return 'toggle'
    return hooks.canEditCell(props) ? 'edit' : null
  })

  const shown = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => {
      if (deleted || mode === 'toggle') return false
      if (mode === 'edit')
        return !isEditingCell(state?.active ?? null, row.id, column.id)
      // Отправленное сохранение держит кнопку даже после смены предиката.
      const view = cellEditingViewOf(state, row.id, column.id)
      return !!view && view !== 'editing'
    },
  )
  if (!shown) return null
  return (
    <SimpleCellButton
      label={cellEditingLabels(labels).editCell}
      icon={<EditIcon width={16} height={16} />}
      onClick={event => beginEdit(table, row, column, hooks, sourceOf(event))}
    />
  )
})
