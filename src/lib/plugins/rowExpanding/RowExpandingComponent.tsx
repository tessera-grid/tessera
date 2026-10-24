/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`), на
 * ожидании и на неудаче своей строки; бизнес-колбэк — из пропса `hooks` (инъекция
 * definePlugin).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginCellProps } from '../../core/definePlugin'
import type { FailedAttempt } from '../../core/failedAttempts'
import { useLocalization } from '../../core/localization'
import { useSlice, useSliceProjection } from '../../core/reactivity'
import { rejectionText } from '../../core/thenable'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import { toggleRowExpanded } from './toggleRowExpanded'
import type { RowExpandingHooks } from './types'

export const RowExpandingComponent = ({
  row,
  table,
  hooks,
}: PluginCellProps<Partial<RowExpandingHooks>>) => {
  useSlice(table, 'expanded')
  const pending = useSliceProjection(
    table,
    'rowExpandPending',
    (value: Record<string, number> | undefined) => !!value?.[row.id],
  )
  const failed = useSliceProjection(
    table,
    'rowExpandFailed',
    (value: Record<string, FailedAttempt> | undefined) => value?.[row.id],
  )
  const labels = useLocalization()

  if (!row.getCanExpand()) {
    return null
  }

  const onExpand = (event: unknown) => {
    reportAction(table, {
      plugin: 'rowExpanding',
      action: 'toggleRow',
      detail: { rowId: row.id, expanded: !row.getIsExpanded() },
      source: sourceOf(event),
    })
    toggleRowExpanded(row, hooks)
  }

  return (
    <ExpandButton
      expanded={row.getIsExpanded()}
      pending={pending}
      failure={
        failed &&
        labels.actionFailedRetry(
          rejectionText(failed.error) ?? labels.loadChildrenFailed,
        )
      }
      onClick={onExpand}
    />
  )
}
