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
   * Кто показывает ожидание: `'cell'` (по умолчанию) — волна на ячейках цели, для события
   * без контрола; `'control'` — контрол в ячейке сам, ячейка несёт только `aria-busy`.
   */
  indicator?: 'cell' | 'control'
  /** Действие справочника — имя записи отказа и объявления итога (ADR 0182, §5). */
  action?: ActionRef
  /** Имя действия от приложения — его переводом; без `action` и `label` — «Сохранение». */
  label?: string
  /** Вспышка `accepted` на цели после успеха. */
  flashOnSuccess?: boolean
  /**
   * Повтор действия после отказа: с ним в поповере треугольника ячейки — «Повторить»
   * (ADR 0177, OB15). Без него человек повторяет тем же контролом или жестом.
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

/** Ожидание ячейки для её контрола: `'wave'`, `'busy'` или нет (AC4). */
export const useCellPending = (
  table: unknown,
  rowId: string,
  columnId: string,
): 'wave' | 'busy' | undefined =>
  useSliceProjection(table, 'actionStatus', status =>
    cellPendingOf(table, status, rowId, columnId),
  )
