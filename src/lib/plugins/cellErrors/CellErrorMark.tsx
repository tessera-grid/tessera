/**
 * Треугольник ошибки данных ячейки (ADR 0150; ADR 0177, §5): тот же, что у отказа сохранения,
 * в правом верхнем углу ячейки при любом её содержимом. Пока у ячейки есть отказ сохранения,
 * треугольник один — отказа (его причина первой), этот не рисуется.
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { useCellFailure } from '../../core/failures/failuresFeature'
import { useLocalization } from '../../core/localization'
import { usePredicateResult } from '../../core/renderVersion'
import { CellIssue } from '../../ui/CellIssue'
import { CellInvalid } from '../../ui/cellControls/CellInvalid'
import type { CellErrorsHooks } from './types'

export const CellErrorMark = (props: PluginCellProps<CellErrorsHooks>) => {
  const { table, row, column, hooks } = props
  const labels = useLocalization()
  const error = usePredicateResult(() => hooks.getCellError(props))
  const failure = useCellFailure(table, row.id, column.id)
  if (!error || failure) {
    return null
  }
  return (
    <>
      <CellInvalid />
      <CellIssue reason={error} label={labels.cellError} />
    </>
  )
}
