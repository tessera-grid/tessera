/**
 * Итог клиентской транзакции на строках (ADR 0199, §6): когда приложение положило следующий
 * `data`, добавленные строки вспыхивают «пришла», а добавление и удаление объявляются — как у
 * серверной модели (ADR 0157, RT9–RT10). Новый `data` без транзакции — без вспышки.
 */
import { announceLabel } from './announcer'
import { flashOutcome } from './flashes/flashFeature'

interface PendingOutcome {
  added: Set<string>
  removed: Set<string>
}

const pending = new WeakMap<object, PendingOutcome>()

/** Транзакция отдана приложению: её итог показывается со следующим `data`. */
export const expectTransactionOutcome = (
  table: unknown,
  added: readonly string[],
  removed: readonly string[],
) => {
  if (added.length === 0 && removed.length === 0) return
  const key = table as object
  let outcome = pending.get(key)
  if (!outcome) {
    outcome = { added: new Set(), removed: new Set() }
    pending.set(key, outcome)
  }
  for (const id of added) outcome.added.add(id)
  for (const id of removed) outcome.removed.add(id)
}

/**
 * Первый новый `data` после транзакции: вспышка добавленных, что в нём есть, и объявление.
 * Ожидание снимается и тогда, когда приложение положило не тот `data`.
 */
export const settleTransactionOutcome = (
  table: unknown,
  has: (id: string) => boolean,
) => {
  const key = table as object
  const outcome = pending.get(key)
  if (!outcome) return
  pending.delete(key)
  const arrived = [...outcome.added].filter(has)
  let removed = 0
  for (const id of outcome.removed) if (!has(id)) removed++
  if (arrived.length) {
    flashOutcome(
      table,
      arrived.map(row => ({ row })),
      'arrived',
    )
  }
  if (arrived.length || removed) {
    announceLabel(table, labels =>
      [
        arrived.length ? labels.announceRowsAdded(arrived.length) : '',
        removed ? labels.announceRowsRemoved(removed) : '',
      ]
        .filter(Boolean)
        .join('. '),
    )
  }
}
