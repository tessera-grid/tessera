// Сверка «требование ↔ тест» (ADR 0043, TQ10): чистая логика без ввода-вывода.
// Ввод-вывод и базовый список — в check-requirements.mjs.

export interface Requirement {
  id: string
  adr: string
  /** Проверяется ли требование тестом с его ID (иначе — ревью, отчёт, тест фичи). */
  tested: boolean
  /** Требования, чьи тесты покрывают это (ячейка `→ ID, ID`). */
  coveredBy?: string[]
}

export interface TestName {
  id: string
  file: string
  line: number
}

export type ProblemKind =
  'missing' | 'duplicate' | 'unknown' | 'collision' | 'reference'

export interface Problem {
  kind: ProblemKind
  id: string
  detail: string
}

export interface BaselineEntry {
  kind: ProblemKind
  id: string
  reason: string
}

/** Начало ячейки вида или теста, при котором теста с ID требования не нужно. */
const UNTESTED_KINDS = new Set([
  'отчёт',
  'ревью',
  'тест фичи',
  'линт',
  'скрипт',
])

const ID = '[A-Z][A-Za-z]*-?\\d+[a-z]?'
const ID_CELL = new RegExp(`^${ID}$`)
const KIND_HEADER = /^(Вид|Проверка|Тест)$/
const COVERED_BY = new RegExp(`^→\\s*(${ID}(?:\\s*,\\s*${ID})*)$`)

const isAccepted = (text: string) =>
  /^(?:- \*\*Статус:\*\*|Статус:)\s*Принято/m.test(text)

/**
 * Требования из таблиц `| ID | Требование | … |` принятого ADR. Строка, чей ID не
 * одиночный (`IV6/IV8/IV10`, `AM15–AM19`) или ссылка (`[CP14](…)`), — чужое требование.
 * Ячейка `→ ID, ID` — требование покрыто тестами перечисленных требований.
 */
export const parseRequirements = (text: string, adr: string): Requirement[] => {
  if (!isAccepted(text)) return []
  const result: Requirement[] = []
  let header: string[] | null = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) {
      header = null
      continue
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
    if (cells[0] === 'ID') {
      header = cells
      continue
    }
    if (!header || /^-+$/.test(cells[0])) continue
    const id = cells[0].replace(/[*`]/g, '')
    if (!ID_CELL.test(id)) continue
    const kindColumn = header.findIndex(cell => KIND_HEADER.test(cell))
    const kind = kindColumn > 0 ? cells[kindColumn] : ''
    const covered = cells
      .slice(2)
      .map(cell => COVERED_BY.exec(cell.replace(/`/g, ''))?.[1])
      .find(Boolean)
    if (covered) {
      const coveredBy = covered.split(',').map(ref => ref.trim())
      result.push({ id, adr, tested: false, coveredBy })
      continue
    }
    const untested = [...UNTESTED_KINDS].some(word => kind.startsWith(word))
    result.push({ id, adr, tested: !untested })
  }
  return result
}

const TEST_CALL =
  /\b(?:test|it)(?:\.each\([^)]*\))?(?:\.(?:only|skip|fails|todo|concurrent))*\(\s*(['"`])((?:\\.|(?!\1).)*)\1?/g
const LEADING_ID = new RegExp(`^(${ID})(?=[:\\s])`)
const CASE_ID = new RegExp(`\\bid:\\s*['"](${ID})['"]`, 'g')

/**
 * ID из имён тестов файла: имя начинается с `<ID>:` (или `<ID> `). Имя-шаблон
 * `${c.id}: …` в цикле по кейсам даёт ID всех `id: '…'` этого файла.
 */
export const parseTestNames = (text: string, file: string): TestName[] => {
  const result: TestName[] = []
  const lineOf = (index: number) => text.slice(0, index).split('\n').length
  for (const match of text.matchAll(TEST_CALL)) {
    const name = match[2]
    const line = lineOf(match.index)
    if (match[1] === '`' && /^\$\{\s*\w+\.id\s*\}/.test(name)) {
      for (const caseMatch of text.matchAll(CASE_ID)) {
        result.push({ id: caseMatch[1], file, line: lineOf(caseMatch.index) })
      }
      continue
    }
    const id = LEADING_ID.exec(name)?.[1]
    if (id) result.push({ id, file, line })
  }
  return result
}

/** Расхождения требований и тестов. */
export const findProblems = (
  requirements: Requirement[],
  tests: TestName[],
): Problem[] => {
  const problems: Problem[] = []
  const adrsById = new Map<string, Set<string>>()
  for (const r of requirements) {
    adrsById.set(r.id, (adrsById.get(r.id) ?? new Set()).add(r.adr))
  }
  const testsById = new Map<string, TestName[]>()
  for (const t of tests) {
    testsById.set(t.id, [...(testsById.get(t.id) ?? []), t])
  }
  const where = (list: TestName[]) =>
    list.map(t => `${t.file}:${t.line}`).join(', ')

  for (const [id, adrs] of adrsById) {
    if (adrs.size > 1) {
      problems.push({ kind: 'collision', id, detail: [...adrs].join(', ') })
    }
  }
  const testedIds = new Set(requirements.filter(r => r.tested).map(r => r.id))
  for (const id of testedIds) {
    const found = testsById.get(id) ?? []
    if (found.length === 0) {
      problems.push({
        kind: 'missing',
        id,
        detail: [...adrsById.get(id)!].join(', '),
      })
    } else if (found.length > 1) {
      problems.push({ kind: 'duplicate', id, detail: where(found) })
    }
  }
  for (const r of requirements) {
    const broken = (r.coveredBy ?? []).filter(
      ref => !adrsById.has(ref) || !testsById.has(ref),
    )
    if (broken.length > 0) {
      problems.push({ kind: 'reference', id: r.id, detail: broken.join(', ') })
    }
  }
  for (const [id, found] of testsById) {
    if (!adrsById.has(id)) {
      problems.push({ kind: 'unknown', id, detail: where(found) })
    }
  }
  return problems.sort((a, b) =>
    a.kind === b.kind
      ? a.id.localeCompare(b.id, 'en', { numeric: true })
      : a.kind.localeCompare(b.kind),
  )
}

const keyOf = (p: { kind: ProblemKind; id: string }) => `${p.kind}:${p.id}`

/**
 * Сверка с базовым списком: новые расхождения и записи базы, которые больше не
 * расходятся (список только сокращается).
 */
export const compareWithBaseline = (
  problems: Problem[],
  baseline: BaselineEntry[],
) => {
  const known = new Set(baseline.map(keyOf))
  const found = new Set(problems.map(keyOf))
  return {
    fresh: problems.filter(p => !known.has(keyOf(p))),
    stale: baseline.filter(entry => !found.has(keyOf(entry))),
  }
}
