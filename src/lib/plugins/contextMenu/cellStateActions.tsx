/**
 * Пункты меню занятой и помеченной ячейки (ADR 0177, §5, §8, OB16): отменить ждущее сохранение
 * или действие её строки и колонки, повторить отклонённое сохранение, отбросить изменение. Пункты
 * читают общие срезы ядра — ждущие операции и реестр отказов, — поэтому работают с любым
 * источником. Несохранённое значение — «Откатить» (ADR 0178, §6).
 */
import { RotateCcw, Undo2, X } from 'lucide-react'

import {
  cancelPending,
  cancelSourceOf,
  cellPendingId,
  hasPending,
} from '../../core/cancellation'
import {
  activeDrafts,
  discardDraft,
  draftKindOf,
} from '../../core/drafts/drafts'
import {
  cellFailureOf,
  readFailures,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import {
  type ContextMenuAction,
  type ContextMenuContext,
  cancelRunningAction,
  runningSlotActionAt,
} from '../../core/headerActions'

const cellOf = ({ row, column }: ContextMenuContext) =>
  [row.id, column.id] as const

const failureOf = (ctx: ContextMenuContext) =>
  cellFailureOf(readFailures(ctx.table), ...cellOf(ctx))

const saving = (ctx: ContextMenuContext) => ({
  kind: 'cellEdit' as const,
  id: cellPendingId(...cellOf(ctx)),
})

const cancelSaveAction: ContextMenuAction = {
  id: 'contextMenu:cancelSave',
  order: -30,
  icon: () => <X width={16} height={16} />,
  label: (_ctx, labels) => labels.cancelSave,
  visible: ctx => hasPending(ctx.table, saving(ctx)),
  onSelect: (ctx, event) => {
    cancelPending(ctx.table, saving(ctx), cancelSourceOf(event))
  },
}

const cancelSlotAction: ContextMenuAction = {
  id: 'contextMenu:cancelAction',
  order: -30,
  icon: () => <X width={16} height={16} />,
  label: (ctx, labels) => {
    const running = runningSlotActionAt(ctx.table, ...cellOf(ctx))
    return labels.cancelAction(running ? running.action.label(ctx, labels) : '')
  },
  visible: ctx => !!runningSlotActionAt(ctx.table, ...cellOf(ctx)),
  onSelect: (ctx, event) => {
    const running = runningSlotActionAt(ctx.table, ...cellOf(ctx))
    if (running)
      cancelRunningAction(ctx.table, running.key, cancelSourceOf(event))
  },
}

const retrySaveAction: ContextMenuAction = {
  id: 'contextMenu:retrySave',
  order: -20,
  icon: () => <RotateCcw width={16} height={16} />,
  label: (_ctx, labels) => labels.retrySave,
  visible: ctx => !!failureOf(ctx)?.retry,
  onSelect: ctx => {
    void failureOf(ctx)?.retry?.()
  },
}

const discardChangeAction: ContextMenuAction = {
  id: 'contextMenu:discardChange',
  order: -20,
  icon: () => <Undo2 width={16} height={16} />,
  label: (_ctx, labels) => labels.failureDiscard,
  visible: ctx => !!failureOf(ctx),
  onSelect: ctx => {
    const failure = failureOf(ctx)
    if (!failure) return
    failure.discard?.()
    resolveFailure(ctx.table, failure.key)
  },
}

/** Несохранённое значение ячейки — черновик любого вида с целью «ячейка» (ADR 0178, §6). */
const draftOf = (ctx: ContextMenuContext) => {
  const [rowId, columnId] = cellOf(ctx)
  return activeDrafts(ctx.table).find(
    draft =>
      'cell' in draft.target &&
      draft.target.cell[0] === rowId &&
      draft.target.cell[1] === columnId,
  )
}

const rollbackDraftAction: ContextMenuAction = {
  id: 'contextMenu:rollbackDraft',
  order: -20,
  icon: () => <Undo2 width={16} height={16} />,
  label: (_ctx, labels) => labels.cellDraftRollback,
  // Отказ главнее: у ячейки с отказом — «Отбросить изменение», оно снимает и черновик.
  visible: ctx => !failureOf(ctx) && !!draftOf(ctx),
  onSelect: ctx => {
    const draft = draftOf(ctx)
    if (draft) discardDraft(ctx.table, draft)
  },
}

/** Черновик строки, меняющий её вид: новая или удалённая (ADR 0178, §7). */
const rowDraftOf = (ctx: ContextMenuContext) =>
  activeDrafts(ctx.table).find(
    draft =>
      'row' in draft.target &&
      draft.target.row === ctx.row.id &&
      !!draftKindOf(ctx.table, draft.kind)?.rowMark,
  )

const rollbackRowDraftAction: ContextMenuAction = {
  id: 'contextMenu:rollbackRowDraft',
  order: -20,
  icon: () => <Undo2 width={16} height={16} />,
  label: (ctx, labels) =>
    draftKindOf(ctx.table, rowDraftOf(ctx)?.kind ?? '')?.rowMark === 'inserted'
      ? labels.rowInsertDiscard
      : labels.rowDeleteDiscard,
  visible: ctx => !!rowDraftOf(ctx),
  onSelect: ctx => {
    const draft = rowDraftOf(ctx)
    if (draft) discardDraft(ctx.table, draft)
  },
}

export const CELL_STATE_ACTIONS: readonly ContextMenuAction[] = [
  cancelSaveAction,
  cancelSlotAction,
  retrySaveAction,
  discardChangeAction,
  rollbackDraftAction,
  rollbackRowDraftAction,
]
