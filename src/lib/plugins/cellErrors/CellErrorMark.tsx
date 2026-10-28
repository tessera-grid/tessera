/**
 * Точка ошибки ячейки (ADR 0150, §2): кнопка кита без значка — отметка отказа с текстом
 * ошибки в тултипе и описании. У ячейки, которую можно править, точку несёт кнопка правки
 * `cellEditing`, и этой кнопки нет.
 */
import { readPluginHooks, type PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { CellButton } from '../../grid/Actions/CellButton'
import { CellInvalid } from '../../grid/cellControls/CellInvalid'
import type { CellEditingHooks } from '../cellEditing/types'
import type { CellErrorsHooks } from './types'

const ignore = () => {}

export const CellErrorMark = (props: PluginCellProps<CellErrorsHooks>) => {
  const { table, hooks } = props
  const labels = useLocalization()
  const error = hooks.getCellError(props)
  const editing = readPluginHooks<Partial<CellEditingHooks>>(
    table as never,
    'cellEditing',
  )
  if (!error || editing.canEditCell?.(props)) {
    return null
  }
  return (
    <>
      <CellInvalid />
      <CellButton
        label={labels.cellError}
        icon={null}
        failure={error}
        onClick={ignore}
      />
    </>
  )
}
