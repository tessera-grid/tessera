/**
 * Отметка несохранённого значения ячейки (ADR 0178, §6): полый уголок кита на месте
 * треугольника отказа; пока у ячейки есть отказ, рисуется он. Нажатие — поповер «было,
 * стало» и «Сбросить».
 */
import type { PluginCellProps } from '../../core/definePlugin'
import {
  discardDraft,
  draftValueDetails,
  useDraft,
  type Draft,
} from '../../core/drafts/drafts'
import { useCellFailure } from '../../core/failures/failuresFeature'
import { useLocalization } from '../../core/localization'
import { CellIssue } from '../../ui/CellIssue'
import { editTextOf } from './editValue'
import { CELL_VALUE_DRAFT, type CellDraftValue } from './session'
import type { CellEditingHooks } from './types'
import { cellEditingLabels } from './labels'

export const CellDraftMark = (props: PluginCellProps<CellEditingHooks>) => {
  const { table, row, column } = props
  const draft = useDraft(table, CELL_VALUE_DRAFT, {
    cell: [row.id, column.id],
  })
  return draft ? <DraftIssue {...props} draft={draft} /> : null
}

const DraftIssue = ({
  table,
  row,
  column,
  draft,
}: PluginCellProps<CellEditingHooks> & { draft: Draft }) => {
  const labels = useLocalization()
  if (useCellFailure(table, row.id, column.id)) return null
  const was = editTextOf(table, column.id, row.getValue(column.id))
  const now = (draft.value as CellDraftValue).text
  return (
    <CellIssue
      tone="draft"
      reason={cellEditingLabels(labels).cellDraftReason(was, now)}
      label={cellEditingLabels(labels).cellDraft}
      details={draftValueDetails(labels, was, now)}
      actions={[
        {
          id: 'rollback',
          label: cellEditingLabels(labels).cellDraftRollback,
          onSelect: () => discardDraft(table, draft),
          primary: true,
          tone: 'danger',
        },
      ]}
    />
  )
}
