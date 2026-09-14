import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureScrollWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  ANIMATION_BUDGET_MS,
  CPU_THROTTLE_RATE,
  LARGE,
  NO_PLUGINS,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'

// Производительность ПРОКРУТКИ (ADR 0009): операция × объём × плагины, замер на
// PROD-сборке под ×4 CPU-троттлингом, метрика p95 работы на кадр по обеим осям.
//
// ПОЛИТИКА ПОРОГОВ (см. память perf-methodology):
//  - ЖЁСТКИЙ гейт 60fps (p95 ≤ 16.67мс, RAIL Animation) — там, где это достижимо
//    надёжно: небольшой грид (P2). Это baseline, обязан держаться.
//  - РЕГРЕСС-ГЕЙТ (фиксируем показатели + сверяем с ПОТОЛКОМ заметно выше текущего) —
//    для крупных/фичастых кейсов (P4 1000 колонок, P7/P8 все плагины). Причина: под
//    ×4 троттлингом даже 1000-колоночный грид (без плагинов!) на горизонтальном
//    скролле у самой границы 60fps, а «широкий × все плагины» — за пределами
//    DOM-архитектуры в принципе (ведущие DOM-гриды дают ~27–38fps на скролле даже без
//    троттлинга на быстром M4; 60fps на масштабе — только canvas). Потолок ловит
//    реальную деградацию, но не флапает на дисперсии замера. Реальные p95 всё равно
//    пишутся в дашборд для наблюдения за трендом (эталон 60fps там виден).

interface ScrollCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  // Потолки регресс-гейта для фичастых кейсов (p95 по осям). Нет → жёсткий 60fps.
  regressionCeiling?: { y: number; x: number }
}

const CASES: ScrollCase[] = [
  {
    id: 'P2',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
  },
  {
    id: 'P4',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
    // 1000 колонок под ×4 троттлингом — у самой границы 60fps (шумит 16–24мс),
    // жёсткий гейт флапал бы; регресс-гейт с запасом.
    regressionCeiling: { y: 26, x: 30 },
  },
  {
    id: 'P7',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    regressionCeiling: { y: 28, x: 45 },
  },
  {
    id: 'P8',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    regressionCeiling: { y: 34, x: 70 },
  },
]

// Готовность — по контракту селекторов (`.data-grid__head-cell`), а не по тексту
// мока (см. ADR 0009 — запрет хардкода мок-данных).
const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

describe('Производительность прокрутки', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args)
        await waitForGrid()

        const y = await measureScrollWork('y')
        const x = await measureScrollWork('x')

        const budgetY = c.regressionCeiling?.y ?? ANIMATION_BUDGET_MS
        const budgetX = c.regressionCeiling?.x ?? ANIMATION_BUDGET_MS
        const size =
          c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'
        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'scroll',
          size,
          plugins: c.args.enableColumnSorting ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          // Фичастые кейсы не держатся к 60fps — сверяются с регресс-потолком.
          knownShortfall: c.regressionCeiling !== undefined,
          metrics: [
            {
              axis: 'y',
              kind: 'animation',
              metric: 'p95',
              valueMs: y.p95Ms,
              budgetMs: budgetY,
              pass: y.p95Ms <= budgetY,
              ...y,
            },
            {
              axis: 'x',
              kind: 'animation',
              metric: 'p95',
              valueMs: x.p95Ms,
              budgetMs: budgetX,
              pass: x.p95Ms <= budgetX,
              ...x,
            },
          ],
        })

        // soft — обе оси репортятся независимо. Без плагинов сверяем с 60fps-бюджетом,
        // с плагинами — с регресс-потолком (см. политику в шапке файла).
        expect.soft(
          y.p95Ms,
          `Y p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms over-budget=${y.tasksOverBudget}/${y.taskCount} (limit ${budgetY})`,
        ).toBeLessThanOrEqual(budgetY)
        expect.soft(
          x.p95Ms,
          `X p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms over-budget=${x.tasksOverBudget}/${x.taskCount} (limit ${budgetX})`,
        ).toBeLessThanOrEqual(budgetX)
      },
      PERF_TIMEOUT,
    )
  }
})
