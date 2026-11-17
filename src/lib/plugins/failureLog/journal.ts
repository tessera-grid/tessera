/**
 * Записи журнала отказов (ADR 0227, §4): отказы одного `batch` с одной причиной и одним видом
 * цели — одна группа; группа из одного отказа — обычная запись. Действия набора —
 * одним вызовом источника (`bulk`), иначе по записи.
 */
import {
  type Failure,
  type Failures,
  resolveFailures,
} from '../../core/failures/failuresFeature'

/** Вид цели группы: ячейки, строки или прочие объекты. */
export type GroupUnit = 'cell' | 'row' | 'item'

export type JournalEntry =
  | { kind: 'single'; key: string; failure: Failure }
  | { kind: 'group'; key: string; unit: GroupUnit; failures: Failure[] }

const unitOf = (failure: Failure): GroupUnit =>
  'cell' in failure.target ? 'cell' : 'row' in failure.target ? 'row' : 'item'

const groupKeyOf = (failure: Failure) =>
  failure.batch === undefined
    ? undefined
    : [failure.batch, unitOf(failure), failure.reason].join('\u0000')

/** Отказы новые сверху; в одну миллисекунду — по порядку записи. */
export const newestFirst = (failures: Failures | undefined) =>
  Object.values(failures ?? {})
    .map((failure, order) => ({ failure, order }))
    .sort((a, b) => b.failure.time - a.failure.time || b.order - a.order)
    .map(({ failure }) => failure)

/** Записи журнала по отказам новые сверху: группа стоит на месте своего нового отказа. */
export const journalOf = (failures: readonly Failure[]): JournalEntry[] => {
  const groups = new Map<string, Failure[]>()
  const order: (string | Failure)[] = []
  for (const failure of failures) {
    const key = groupKeyOf(failure)
    if (key === undefined) {
      order.push(failure)
      continue
    }
    const members = groups.get(key)
    if (members) members.push(failure)
    else {
      groups.set(key, [failure])
      order.push(key)
    }
  }
  return order.map(item => {
    if (typeof item !== 'string')
      return { kind: 'single', key: item.key, failure: item }
    const members = groups.get(item)!
    return members.length === 1
      ? { kind: 'single', key: members[0]!.key, failure: members[0]! }
      : {
          kind: 'group',
          key: `group\u0000${item}`,
          unit: unitOf(members[0]!),
          failures: members,
        }
  })
}

/** Число записей журнала: счётчик кнопки (AO6). */
export const journalCount = (failures: Failures | undefined) =>
  journalOf(Object.values(failures ?? {})).length

/** «Повторить» или «Отбросить» для набора: функцией набора источника или по записи. */
const runAll = (failures: readonly Failure[], kind: 'retry' | 'discard') => {
  const bulks = new Map<
    string,
    { run: (keys: readonly string[]) => void; keys: string[] }
  >()
  for (const failure of failures) {
    if (!failure[kind]) continue
    const bulk = failure.bulk
    const run = bulk?.[kind]
    if (!bulk || !run) {
      failure[kind]!()
      continue
    }
    const group = bulks.get(bulk.owner) ?? { run, keys: [] }
    group.keys.push(failure.key)
    bulks.set(bulk.owner, group)
  }
  for (const { run, keys } of bulks.values()) run(keys)
}

export const retryAll = (failures: readonly Failure[]) =>
  runAll(failures, 'retry')

/** Отбросить правки набора и закрыть записи без правок: после вызова записи уходят. */
export const discardAll = (table: unknown, failures: readonly Failure[]) => {
  runAll(failures, 'discard')
  closeAll(table, failures)
}

/** Снять записи без правок одной записью в реестр. */
export const closeAll = (table: unknown, failures: readonly Failure[]) =>
  resolveFailures(
    table,
    failures.map(failure => failure.key),
  )

/** Правок за записями набора: число записей с `discard`. */
export const editsIn = (failures: readonly Failure[]) =>
  failures.filter(failure => failure.discard).length
