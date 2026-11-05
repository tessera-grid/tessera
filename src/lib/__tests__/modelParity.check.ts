/**
 * Сверка базы паритета моделей строк (ADR 0187): чистые функции, чтобы страж проверял и себя на
 * испорченной базе.
 */

export interface Difference {
  reason: string
  adr: number
}

export interface Debt {
  reason: string
  /** Заголовок записи в «Известных проблемах» roadmap. */
  roadmap: string
}

export interface FactoryParity {
  same?: readonly string[]
  differs?: Readonly<Record<string, Difference>>
  debt?: Readonly<Record<string, Debt>>
  /** Инертна в серверной модели целиком: аргументы отдельно не решаются. */
  inertOnServer?: Difference
  /** Только для серверной модели. */
  onlyOnServer?: Difference
}

export type ParityBase = Readonly<Record<string, FactoryParity>>

export interface BehaviourDifference extends Difference {
  name: string
}

const MIN_REASON = 10

const argumentsOf = (entry: FactoryParity) => [
  ...(entry.same ?? []),
  ...Object.keys(entry.differs ?? {}),
  ...Object.keys(entry.debt ?? {}),
]

/** PY1: каждый аргумент записан ровно раз, лишних записей нет. */
export const argumentProblems = (
  base: ParityBase,
  actual: Readonly<Record<string, readonly string[]>>,
) => {
  const problems: string[] = []
  for (const [factory, args] of Object.entries(actual)) {
    const entry = base[factory]
    if (!entry) {
      problems.push(`${factory}: нет в базе`)
      continue
    }
    if (entry.inertOnServer || entry.onlyOnServer) continue
    const recorded = argumentsOf(entry)
    for (const name of args) {
      if (!recorded.includes(name)) {
        problems.push(`${factory}.${name}: аргумента нет в базе`)
      }
    }
    for (const name of recorded) {
      if (!args.includes(name)) {
        problems.push(`${factory}.${name}: запись без аргумента`)
      }
      if (recorded.indexOf(name) !== recorded.lastIndexOf(name)) {
        problems.push(`${factory}.${name}: записан дважды`)
      }
    }
  }
  for (const factory of Object.keys(base)) {
    if (!(factory in actual)) problems.push(`${factory}: фабрики нет`)
  }
  return [...new Set(problems)]
}

const differenceProblems = (
  where: string,
  { reason, adr }: Difference,
  adrExists: (adr: number) => boolean,
) => [
  ...(reason.trim().length < MIN_REASON ? [`${where}: нет причины`] : []),
  ...(adrExists(adr) ? [] : [`${where}: нет ADR ${adr}`]),
]

/** PY2: у различия есть причина и существующий ADR. */
export const differenceRecordProblems = (
  base: ParityBase,
  adrExists: (adr: number) => boolean,
) =>
  Object.entries(base).flatMap(([factory, entry]) => [
    ...Object.entries(entry.differs ?? {}).flatMap(([name, difference]) =>
      differenceProblems(`${factory}.${name}`, difference, adrExists),
    ),
    ...(entry.inertOnServer
      ? differenceProblems(factory, entry.inertOnServer, adrExists)
      : []),
    ...(entry.onlyOnServer
      ? differenceProblems(factory, entry.onlyOnServer, adrExists)
      : []),
  ])

/** PY3: долг ссылается на запись «Известных проблем». */
export const debtProblems = (base: ParityBase, knownProblems: string) =>
  Object.entries(base).flatMap(([factory, entry]) =>
    Object.entries(entry.debt ?? {}).flatMap(([name, debt]) =>
      debt.roadmap.trim() !== '' && knownProblems.includes(debt.roadmap)
        ? []
        : [`${factory}.${name}: нет в «Известных проблемах»`],
    ),
  )

export interface ModelStatus {
  client: string
  server: string
}

/** PY4: инертность только в SSRM записана, запись подтверждена диагностикой. */
export const inertProblems = (
  base: ParityBase,
  statuses: Readonly<Record<string, ModelStatus>>,
) =>
  Object.entries(statuses).flatMap(([factory, { client, server }]) => {
    const entry = base[factory]
    const onlyServerInert = server !== client && server.startsWith('inert')
    if (onlyServerInert && !entry?.inertOnServer) {
      return [`${factory}: инертна в SSRM (${server}) без записи`]
    }
    if (!onlyServerInert && entry?.inertOnServer) {
      return [`${factory}: запись об инертности устарела`]
    }
    return client === server || onlyServerInert
      ? []
      : [`${factory}: статусы моделей разошлись: ${client} / ${server}`]
  })

/** PY5: различия поведения записаны теми же полями, имена не повторяются. */
export const behaviourProblems = (
  behaviours: readonly BehaviourDifference[],
  adrExists: (adr: number) => boolean,
) => {
  const names = behaviours.map(item => item.name)
  return [
    ...behaviours.flatMap(item =>
      differenceProblems(item.name, item, adrExists),
    ),
    ...names
      .filter((name, index) => names.indexOf(name) !== index)
      .map(name => `${name}: записано дважды`),
  ]
}
