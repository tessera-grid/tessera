import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  HISTORY_LIMIT,
  type PerfReport,
  type ReportMetric,
  appendHistory,
  compareReport,
  formatCompareTable,
  metricStatus,
  renderDashboard,
  trendOf,
} from '../../../scripts/perfTools'

// Перф-дашборд и отчёт сравнения (ADR 0099, PF1, PF17, PF19).

const PERF_DIR = join(process.cwd(), 'src/lib/stories/__tests__/performance')

const metric = (
  valueMs: number,
  extra: Partial<ReportMetric> = {},
): ReportMetric => ({
  axis: 'y',
  kind: 'animation',
  metric: 'p95',
  valueMs,
  targetMs: 16.7,
  p95Ms: valueMs,
  p99Ms: valueMs,
  longestMs: valueMs,
  longTasks: 0,
  tbtMs: 0,
  ...extra,
})

const report = (generatedAt: string, value: number): PerfReport => ({
  generatedAt,
  records: [
    {
      id: 'P2',
      label: 'небольшая выборка',
      operation: 'scroll',
      size: '30×500',
      plugins: 'none',
      cpuThrottle: 4,
      metrics: [metric(value)],
    },
    {
      id: 'GL13',
      label: 'обновление',
      operation: 'scroll',
      size: '1000×1000',
      plugins: 'loading',
      cpuThrottle: 4,
      metrics: [metric(value, { ceilingMs: 12 })],
    },
  ],
})

describe('Перф-дашборд', () => {
  it('PF1: кейс матрицы не падает на абсолютном времени — проверки времени в перф-наборе только против потолка от базы того же теста; regressionCeiling, knownShortfall и test.fails удалены', () => {
    const files = readdirSync(PERF_DIR).filter(f => f.endsWith('.test.tsx'))
    expect(files.length).toBeGreaterThan(0)
    const problems: string[] = []
    for (const file of files) {
      const text = readFileSync(join(PERF_DIR, file), 'utf8')
      for (const word of ['regressionCeiling', 'knownShortfall', '.fails(']) {
        if (text.includes(word)) problems.push(`${file}: ${word}`)
      }
      // Проверка «не больше» сравнивает время только с потолком, а счётчик — с числом.
      for (const [, target] of text.matchAll(
        /\.toBeLessThan(?:OrEqual)?\(\s*([^)]+?)\s*,?\s*\)/g,
      )) {
        const allowed =
          /^ceiling(\[axis\]|\.\w+)?$/.test(target!) ||
          /^\d$/.test(target!) ||
          /\.(columnCount|dataCount)$/.test(target!)
        if (!allowed) problems.push(`${file}: toBeLessThan(${target})`)
      }
      // Потолок выводится из базы, а не задаётся числом.
      for (const [, rhs] of text.matchAll(/const ceiling = ([^\n]+)/g)) {
        if (!/ceilingOver|axesCeiling|base\.|theirs\.|single\.|^\{$/.test(rhs!))
          problems.push(`${file}: const ceiling = ${rhs}`)
      }
    }
    expect(problems).toEqual([])

    // Вне цели RAIL — статус, а не провал; гейт есть только у метрики с потолком.
    expect(metricStatus(metric(40))).toEqual({ target: 'out', gate: undefined })
    expect(metricStatus(metric(10, { ceilingMs: 12 }))).toEqual({
      target: 'in',
      gate: 'ok',
    })
    expect(metricStatus(metric(13, { ceilingMs: 12 })).gate).toBe('fail')
  })

  it('PF17: отчёт сравнения — кейс, метрика, медианы, отношение, интервал и вердикт — в консоли, в compare.json и разделом дашборда', () => {
    const compare = compareReport(
      {
        rounds: 5,
        results: [
          {
            caseId: 'P2',
            key: 'P2/y/p95',
            medianA: 10,
            medianB: 13,
            samplesA: [10],
            samplesB: [13],
            ratio: 1.3,
            low: 1.21,
            high: 1.38,
            verdict: 'regression',
          },
        ],
      },
      {
        ref: 'master',
        sha: '0123456789abcdef',
        generatedAt: '2026-10-12T00:00:00Z',
      },
    )
    expect(JSON.parse(JSON.stringify(compare))).toMatchObject({
      ref: 'master',
      sha: '0123456789abcdef',
      rounds: 5,
      threshold: 0.1,
      results: [
        { key: 'P2/y/p95', medianA: 10, medianB: 13, verdict: 'regression' },
      ],
    })
    const table = formatCompareTable(compare)
    expect(table).toContain('A = master (01234567)')
    expect(formatCompareTable({ ...compare, sameRevision: true })).toContain(
      'B = та же ревизия',
    )
    expect(table).toMatch(
      /P2\/y\/p95\s+10\.0\s+13\.0\s+1\.300\s+1\.210–1\.380\s+регрессия/,
    )

    const html = renderDashboard(
      report('2026-10-12T00:00:00Z', 10),
      [],
      compare,
    )
    expect(html).toContain('id="compare"')
    expect(html).toContain('Сравнение с master (01234567)')
    expect(html).toContain('регрессия')
  })

  it('PF19: дашборд — значения против целей RAIL и тренд по history.json (последние 50 прогонов), без статусов «xfail» и «регресс»', () => {
    let history = appendHistory([], report('t1', 10))
    // Повторная сборка дашборда по тому же прогону не дублирует историю.
    history = appendHistory(history, report('t1', 10))
    expect(history).toHaveLength(1)
    for (let i = 2; i <= HISTORY_LIMIT + 5; i++) {
      history = appendHistory(history, report(`t${i}`, 10 + i))
    }
    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history[0]!.generatedAt).toBe('t6')
    expect(trendOf(history, 'P2/y/p95').slice(-2)).toEqual([
      10 + HISTORY_LIMIT + 4,
      10 + HISTORY_LIMIT + 5,
    ])

    const html = renderDashboard(report('2026-10-12T00:00:00Z', 20), history)
    expect(html).toContain('ВНЕ ЦЕЛИ')
    expect(html).toContain('/ цель 16.7 мс')
    expect(html).toContain('ХУЖЕ БАЗЫ · потолок 12.0 мс')
    expect(html).toContain('<polyline')
    expect(html).not.toMatch(/XFAIL|РЕГРЕССИЯ|известный недостиг/)
  })
})
