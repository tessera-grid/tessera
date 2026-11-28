/**
 * Ожидание и итог действия на ячейке (ADR 0176): любой промис приложения ставит ожидание на
 * цель — волной на ячейках или только `aria-busy`, когда ожидание рисует контрол сам, — итог
 * снимает его, отказ — вспышкой отката и объявлением.
 */
import { announceLabel, announcerLabels } from '../announcer'
import {
  failureKeyOf,
  reportFailure,
  resolveFailure,
  failureName,
} from '../failures/failuresFeature'
import { ENGLISH_LABELS } from '../localization'
import { flashOutcome } from '../flashes/flashFeature'
import type { FlashTarget } from '../highlights/highlightFeature'
import { useSliceProjection } from '../reactivity'
import { isThenable, rejectionText } from '../../util/thenable'
import { cellPendingOf } from './actionStatus'
import { writeActionStatus } from './actionStatusFeature'
import type { ActionRef } from '../actions'

export interface TrackCellActionOptions {
  /**
   * Who shows the pending state: `'cell'` (default) — a wave on the target cells, for an event
   * without a control; `'control'` — the control in the cell shows it, the cell only carries
   * `aria-busy`.
   */
  indicator?: 'cell' | 'control'
  /** Catalog action — the name of the failure entry and the outcome announcement (ADR 0182, §5). */
  action?: ActionRef
  /** Action name from the application — already translated; without `action` and `label` — "Saving". */
  label?: string
  /** An `accepted` flash on the target after success. */
  flashOnSuccess?: boolean
  /**
   * Retries the action after a failure: with it, the cell triangle's popover shows "Retry"
   * (ADR 0177, OB15). Without it, the user retries with the same control or gesture.
   */
  retry?: () => unknown
}

let lastAction = 0

const removeEntry = (table: unknown, key: string) =>
  writeActionStatus(table, status => {
    if (!(key in status)) return status
    const next = { ...status }
    delete next[key]
    return next
  })

/** Поставить ожидание промиса на цель и показать его итог (AC1–AC3). */
export const trackCellAction = <T>(
  table: unknown,
  target: FlashTarget | readonly FlashTarget[],
  promise: Promise<T> | T,
  {
    indicator = 'cell',
    action,
    label,
    flashOnSuccess,
    retry,
  }: TrackCellActionOptions = {},
): Promise<T> => {
  if (!isThenable(promise)) return Promise.resolve(promise)
  const targets: readonly FlashTarget[] = Array.isArray(target)
    ? target
    : [target as FlashTarget]
  const key = `cellAction:${++lastAction}`
  writeActionStatus(table, status => ({
    ...status,
    [key]: {
      pending: true,
      target: targets,
      ...(indicator === 'cell' ? { wave: true } : {}),
    },
  }))
  const result = Promise.resolve(promise)
  result.then(
    () => {
      removeEntry(table, key)
      // Успех снимает прежний отказ той же цели (ADR 0177, OB11).
      for (const item of targets) resolveFailure(table, failureKeyOf(item))
      if (flashOnSuccess) flashOutcome(table, targets, 'accepted')
      if (action || label)
        announceLabel(table, labels =>
          labels.announceActionDone(
            failureName(table, { action, label }, labels),
          ),
        )
    },
    (error: unknown) => {
      removeEntry(table, key)
      flashOutcome(table, targets, 'reverted')
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      const named =
        action || label !== undefined
          ? { action, label }
          : { action: { plugin: 'core', action: 'save' } }
      for (const item of targets)
        reportFailure(table, {
          key: failureKeyOf(item),
          ...named,
          target: item,
          reason: rejectionText(error) ?? labels.actionFailedFallback,
          ...(retry ? { retry } : {}),
        })
      announceLabel(table, labels =>
        labels.announceActionFailed(
          failureName(table, named, labels),
          rejectionText(error) ?? labels.actionFailedFallback,
        ),
      )
    },
  )
  return result
}

/** The cell's pending state for its control: `'wave'`, `'busy'` or none (AC4). */
export const useCellPending = (
  table: unknown,
  rowId: string,
  columnId: string,
): 'wave' | 'busy' | undefined =>
  useSliceProjection(table, 'actionStatus', status =>
    cellPendingOf(table, status, rowId, columnId),
  )
