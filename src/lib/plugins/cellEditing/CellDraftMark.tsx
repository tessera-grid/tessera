/**
 * Отметка несохранённого значения ячейки (ADR 0178, §6): полый уголок кита на месте
 * треугольника отказа; пока у ячейки есть отказ, рисуется он. Нажатие — поповер «было,
 * стало» и «Откатить».
 */
import type { PluginCellProps } from '../../core/definePlugin'
import { discardDraft, useDraft } from '../../core/drafts/drafts'
import { useCellFailure } from '../../core/failures/failuresFeature'
import { useLocalization } from '../../core/localization'
import { CellIssue } from '../../ui/CellIssue'
import { editTextOf } from './editValue'
import { CELL_VALUE_DRAFT, type CellDraftValue } from './session'
import type { CellEditingHooks } from './types'

export const CellDraftMark = (props: PluginCellProps<CellEditingHooks>) => {
  const { table, row, column } = props
  const labels = useLocalization()
  const draft = useDraft(table, CELL_VALUE_DRAFT, {
    cell: [row.id, column.id],
  })
  const failure = useCellFailure(table, row.id, column.id)
  if (!draft || failure) {
    return null
  }
  const was = editTextOf(table, column.id, row.getValue(column.id))
  const now = (draft.value as CellDraftValue).text
  return (
    <CellIssue
      tone="draft"
      reason={labels.cellDraftReason(was, now)}
      label={labels.cellDraft}
      actions={[
        {
          id: 'rollback',
          label: labels.cellDraftRollback,
          onSelect: () => discardDraft(table, draft),
        },
      ]}
    />
  )
}
