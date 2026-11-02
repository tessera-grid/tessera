/**
 * Треугольник отказа сохранения значения ячейки (ADR 0177, §5): из реестра отказов, один и
 * тот же для любого содержимого ячейки. «Повторить» — если источник умеет повторять сам,
 * «Отбросить изменение» — всегда.
 */
import { type Failure, resolveFailure } from '../core/failures/failuresFeature'
import { useLocalization } from '../core/localization'
import { CellIssue } from '../ui/CellIssue'
import { CellInvalid } from '../ui/cellControls/CellInvalid'

export const CellFailureMark = ({
  table,
  failure,
}: {
  table: unknown
  failure: Failure
}) => {
  const labels = useLocalization()
  const { retry, discard } = failure
  const actions = [
    ...(retry
      ? [{ id: 'retry', label: labels.failureRetry, onSelect: () => retry() }]
      : []),
    {
      id: 'discard',
      label: labels.failureDiscard,
      onSelect: () => {
        discard?.()
        resolveFailure(table, failure.key)
      },
    },
  ]
  return (
    <>
      <CellInvalid />
      <CellIssue
        reason={failure.reason}
        label={labels.cellError}
        actions={actions}
      />
    </>
  )
}
