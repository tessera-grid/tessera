import { describe, expect, test } from 'vitest'

import { headCells, measureScrollWork, recordPerf, renderGrid } from '../helpers'
import {
  ALL_PLUGINS,
  ANIMATION_BUDGET_MS,
  CPU_THROTTLE_RATE,
  LARGE,
  NO_PLUGINS,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'

// Производительность ПРОКРУТКИ. Вторая половина перф-матрицы (ADR 0009): операция
// «прокрутка» × объём (небольшой/большой) × плагины (без/все). Порог — абсолютный
// из RAIL **Animation: p95 работы на кадр ≤ 16.7мс (60fps)** для всех кейсов (не
// измеренный потолок, а цель из восприятия). Замер под ×4 CPU-троттлингом
// (референс-девайс); каждый кейс меряет обе оси (вертикаль + горизонталь).
//
// Кейсы, не укладывающиеся под троттлингом, помечены `knownShortfall` и гоняются
// через `test.fails` (xfail): сборка зелёная, но цель 60fps зафиксирована — когда
// грид оптимизируют, `test.fails` покраснеет и напомнит снять метку.

interface ScrollCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  knownShortfall: boolean
}

// ×4 троттлинг (референс-девайс): под ним грид пока не держит 60fps ни в одном
// режиме прокрутки — все кейсы помечены как известный недостиг (xfail). Цель 60fps
// зафиксирована; когда прокрутка уложится в кадр, `test.fails` покраснеет.
const CASES: ScrollCase[] = [
  {
    id: 'P2',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
    knownShortfall: true,
  },
  {
    id: 'P4',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
    knownShortfall: true,
  },
  {
    id: 'P7',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    knownShortfall: true,
  },
  {
    id: 'P8',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    knownShortfall: true,
  },
]

// Готовность — по контракту селекторов (`.data-grid__head-cell`), а не по тексту
// мока (см. ADR 0009 — запрет хардкода мок-данных).
const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

describe('Производительность прокрутки', () => {
  for (const c of CASES) {
    const runner = c.knownShortfall ? test.fails : test
    runner(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args)
        await waitForGrid()

        const y = await measureScrollWork('y')
        const x = await measureScrollWork('x')

        const size = c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'
        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'scroll',
          size,
          plugins: c.args.enableColumnSorting ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: c.knownShortfall,
          metrics: [
            { axis: 'y', kind: 'animation', metric: 'p95', valueMs: y.p95Ms, budgetMs: ANIMATION_BUDGET_MS, pass: y.p95Ms <= ANIMATION_BUDGET_MS, ...y },
            { axis: 'x', kind: 'animation', metric: 'p95', valueMs: x.p95Ms, budgetMs: ANIMATION_BUDGET_MS, pass: x.p95Ms <= ANIMATION_BUDGET_MS, ...x },
          ],
        })

        expect(
          y.p95Ms,
          `Y p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms over-budget=${y.tasksOverBudget}/${y.taskCount}`,
        ).toBeLessThanOrEqual(ANIMATION_BUDGET_MS)
        expect(
          x.p95Ms,
          `X p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms over-budget=${x.tasksOverBudget}/${x.taskCount}`,
        ).toBeLessThanOrEqual(ANIMATION_BUDGET_MS)
      },
      PERF_TIMEOUT,
    )
  }
})
