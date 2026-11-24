import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CompareReport } from '../../../scripts/perfTools'

// Самопроверка `perf:compare` настоящими прогонами (ADR 0099, PF15–PF16): ложных тревог
// нет, подмешанная работа ловится. Идёт отдельно — `npm run perf:selftest`, ~20 мин;
// Обе стороны берут HEAD из одного временного дерева, даже если рабочая копия изменена.

const CASES = 'P2,P10'
const TIMEOUT = 60 * 60_000

const compare = (...extra: string[]): CompareReport => {
  const { status } = spawnSync(
    process.execPath,
    [
      'scripts/perf-compare.mjs',
      'HEAD',
      '--same-revision',
      '--cases',
      CASES,
      ...extra,
    ],
    { stdio: 'inherit' },
  )
  expect(status === 0 || status === 1, `perf:compare: код ${status}`).toBe(true)
  return JSON.parse(
    readFileSync(
      join(process.cwd(), 'performance-results/compare.json'),
      'utf8',
    ),
  ) as CompareReport
}

describe('perf:compare — самопроверка', () => {
  it(
    'PF15: A против A на одной ревизии — ни «регрессии», ни «улучшения» в кейсах P2 и P10',
    () => {
      const report = compare()
      expect(report.results.length).toBeGreaterThan(0)
      expect(
        report.results
          .filter(
            r => r.verdict === 'regression' || r.verdict === 'improvement',
          )
          .map(r => `${r.key} ${r.ratio.toFixed(3)} ${r.verdict}`),
      ).toEqual([])
    },
    TIMEOUT,
  )

  it(
    'PF16: подмешанная работа на стороне B (+30 % к длительности задач) — «регрессия» в кейсах P2 и P10',
    () => {
      const report = compare('--inject-b', '30')
      expect(report.results.length).toBeGreaterThan(0)
      expect(
        report.results
          .filter(r => r.verdict !== 'regression')
          .map(r => `${r.key} ${r.ratio.toFixed(3)} ${r.verdict}`),
      ).toEqual([])
    },
    TIMEOUT,
  )
})
