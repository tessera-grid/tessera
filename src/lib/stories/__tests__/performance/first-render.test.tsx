import { cleanup } from 'vitest-browser-react'
import { beforeAll, describe, expect, test } from 'vitest'

import {
  headCells,
  measureRenderWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  LOAD_BUDGET_MS,
  NO_PLUGINS,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'

// Производительность ПЕРВОЙ ОТРИСОВКИ (mount → первый кадр). Половина перф-матрицы
// (ADR 0009): операция «отрисовка» × объём (небольшой/большой) × плагины (без/все).
// Метрика — самая длинная задача монтирования (CDP-трейс), под ×4 CPU-троттлингом.
// Дополнительно фиксируются long tasks (> 50мс) и TBT — сигнал готовности к INP.
//
// ПОЛИТИКА ПОРОГОВ (симметрично scroll, см. память perf-methodology):
//  - БЕЗ плагинов (P1/P3) — абсолютный гейт RAIL Load: longest ≤ 1000мс.
//  - СО всеми плагинами (P5/P6) — фиксируем + регресс-гейт: сверяемся с ПОТОЛКОМ
//    (заметно выше текущего уровня, но много ниже 1000), чтобы ловить реальную
//    деградацию, которую свободный Load-бюджет пропустил бы. Реальные значения пишутся
//    в дашборд для наблюдения за трендом.

interface RenderCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  // Потолок регресс-гейта для фичастых кейсов. Нет → абсолютный Load-бюджет 1000мс.
  regressionCeiling?: number
}

const CASES: RenderCase[] = [
  {
    id: 'P1',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
  },
  {
    id: 'P3',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
  },
  {
    id: 'P5',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    regressionCeiling: 350,
  },
  {
    id: 'P6',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    regressionCeiling: 500,
  },
]

describe('Производительность первой отрисовки', () => {
  // Прогрев JIT один раз лёгким монтированием (без троттлинга): без него первый
  // измеряемый кейс платил бы разовую стоимость компиляции. Пер-тестовый прогрев
  // отключён (`warmup: false`), чтобы не монтировать экстремальный грид дважды.
  beforeAll(async () => {
    renderGrid({ ...SMALL, ...NO_PLUGINS })
    for (let i = 0; i < 600 && headCells().length === 0; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    cleanup()
  })

  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        const result = await measureRenderWork(
          () => renderGrid(c.args),
          () => headCells().length > 0,
          { warmup: false },
        )
        const { longestMs, longTasks, tbtMs } = result
        const budget = c.regressionCeiling ?? LOAD_BUDGET_MS
        const pass = longestMs <= budget

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'render',
          size:
            c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500',
          plugins: c.args.enableColumnSorting ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          // Фичастые кейсы сверяются с регресс-потолком, а не с абсолютным Load.
          knownShortfall: c.regressionCeiling !== undefined,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: longestMs,
              budgetMs: budget,
              pass,
              ...result,
            },
          ],
        })

        expect(
          longestMs,
          `render longest=${longestMs.toFixed(1)}ms (limit ${budget}ms, ×${CPU_THROTTLE_RATE}) longTasks=${longTasks} tbt=${tbtMs.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(budget)
      },
      PERF_TIMEOUT,
    )
  }
})
