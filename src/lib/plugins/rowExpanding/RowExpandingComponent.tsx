/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`), на
 * ожидании и на неудаче своей строки; бизнес-колбэк — из пропса `hooks` (инъекция
 * definePlugin).
 */
import { useEffect } from 'react'

import {
  cancelPending,
  cancelSourceOf,
  registerPending,
} from '../../core/cancellation'
import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginCellProps } from '../../core/definePlugin'
import type { FailedAttempt } from '../../core/failedAttempts'
import { useLocalization } from '../../core/localization'
import {
  useSlice,
  useSliceProjection,
  useTableState,
} from '../../core/reactivity'
import { rowSourceOf } from '../../core/rowSource'
import { rejectionText } from '../../core/thenable'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import { cancelBranchLoad, toggleRowExpanded } from './toggleRowExpanded'
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
  // Ветка серверной модели ждёт первого ответа (ADR 0155, §3): дуга и «стоп», как у ленивых.
  const branchLoading = useTableState(
    table as never,
    () => !!rowSourceOf(table).branchLoading?.(row.id),
  ) as boolean
  useEffect(
    () =>
      branchLoading
        ? registerPending(table, {
            kind: 'children',
            id: row.id,
            cancel: source => cancelBranchLoad(row, source),
          })
        : undefined,
    [branchLoading, table, row],
  )
  const waiting = pending || branchLoading

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
      pending={waiting}
      failure={
        failed &&
        labels.actionFailedRetry(
          rejectionText(failed.error) ?? labels.loadChildrenFailed,
        )
      }
      onClick={onExpand}
      {...(waiting && {
        onCancel: event =>
          pending
            ? cancelPending(
                table,
                { kind: 'children', id: row.id },
                cancelSourceOf(event),
              )
            : cancelBranchLoad(row, cancelSourceOf(event)),
        cancelLabel: labels.cancelAction(labels.expandRow),
      })}
    />
  )
}
