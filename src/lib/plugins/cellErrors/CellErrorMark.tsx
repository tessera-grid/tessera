/**
 * Точка ошибки ячейки (ADR 0150, §2): кнопка кита без значка — отметка отказа с текстом
 * ошибки в тултипе и описании. У ячейки, которую можно править, точку несёт кнопка правки
 * `cellEditing`, и этой кнопки нет.
 */
import { readPluginHooks, type PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { CellButton } from '../../ui/CellButton/CellButton'
import { CellInvalid } from '../../ui/cellControls/CellInvalid'
import type { CellEditHook } from '../../shared/cellHooks'
import type { CellErrorsHooks } from './types'

const ignore = () => {}

export const CellErrorMark = (props: PluginCellProps<CellErrorsHooks>) => {
  const { table, hooks } = props
  const labels = useLocalization()
  const error = hooks.getCellError(props)
  const editing = readPluginHooks<Partial<CellEditHook>>(
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
