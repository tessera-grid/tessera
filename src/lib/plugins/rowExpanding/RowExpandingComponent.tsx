/**
 * Ячейка колонки раскрытия. Реактивность на срезе `expanded` (`useSlice`), на
 * ожидании и на неудаче своей строки; отказ — вспышкой строки и в реестре, без отметки на
 * переключателе (ADR 0177, OB13); бизнес-колбэк — из пропса `hooks` (инъекция
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
import type { FailedAttempt } from '../../shared/failedAttempts'
import { useLocalization } from '../../core/localization'
import {
  useSlice,
  useSliceProjection,
  useTableState,
} from '../../core/reactivity'
import { rowSourceOf } from '../../core/rowSource'
import { ExpandButton } from '../../plugins/rowExpanding/ExpandButton'
import { readLoadedChildren } from './lazyChildrenFeature'
import {
  cancelBranchLoad,
  isLazyRow,
  toggleRowExpanded,
} from './toggleRowExpanded'
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
  // Загрузка детей — дуга и «стоп» на переключателе (ADR 0155, §3); ожидание промиса
  // раскрытия без загрузки — волна строки (ADR 0177, §1).
  const loadsChildren =
    !!hooks.loadChildren && isLazyRow(row, hooks.hasChildren)
  const waiting = (pending && loadsChildren) || branchLoading

  // Человек раскрыл всё кнопкой (ADR 0160, §2): ленивая строка окна грузит детей, когда
  // её ячейка появилась, — и при прокрутке.
  const expandAll = useSlice(table, 'rowExpandAll' as never) as
    boolean | undefined
  useEffect(() => {
    if (!expandAll || failed || !hooks.loadChildren) return
    if (!isLazyRow(row, hooks.hasChildren) || row.getIsExpanded()) return
    if (row.id in readLoadedChildren(table)) return
    toggleRowExpanded(row, hooks)
  }, [expandAll, failed, hooks, row, table])

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
