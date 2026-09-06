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
// Порог — абсолютный из RAIL: **Load < 1000мс** до интерактивности (не измеренный
// потолок, а цель из восприятия). Дополнительно фиксируются long tasks (> 50мс) и
// TBT — сигнал готовности к отзывчивости (CWV INP). Замер идёт под ×4 CPU-троттлингом
// (референс-девайс), метрика — самая длинная задача монтирования (CDP-трейс).
//
// Кейсы, которые под троттлингом не укладываются в Load, помечены `knownShortfall`
// и гоняются через `test.fails` (xfail): сборка зелёная, цель зафиксирована; когда
// грид оптимизируют и кейс уложится — `test.fails` покраснеет и напомнит снять метку.

interface RenderCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  knownShortfall: boolean
}

const CASES: RenderCase[] = [
  {
    id: 'P1',
    label: 'небольшая выборка, без плагинов',
    args: { ...SMALL, ...NO_PLUGINS },
    knownShortfall: false,
  },
  {
    id: 'P3',
    label: 'большая выборка, без плагинов',
    args: { ...LARGE, ...NO_PLUGINS },
    knownShortfall: false,
  },
  {
    id: 'P5',
    label: 'небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    knownShortfall: false,
  },
  {
    id: 'P6',
    label: 'большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    // ×4 троттлинг: монтаж ~2.8с не влезает в Load 1000мс — известный недостиг.
    knownShortfall: true,
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
    const runner = c.knownShortfall ? test.fails : test
    runner(
      `${c.id}: ${c.label}`,
      async () => {
        const result = await measureRenderWork(
          () => renderGrid(c.args),
          () => headCells().length > 0,
          { warmup: false },
        )
        const { longestMs, longTasks, tbtMs } = result
        const pass = longestMs <= LOAD_BUDGET_MS

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'render',
          size:
            c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500',
          plugins: c.args.enableColumnSorting ? 'all' : 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: c.knownShortfall,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: longestMs,
              budgetMs: LOAD_BUDGET_MS,
              pass,
              ...result,
            },
          ],
        })

        expect(
          longestMs,
          `render longest=${longestMs.toFixed(1)}ms (Load-бюджет ${LOAD_BUDGET_MS}ms, ×${CPU_THROTTLE_RATE}) longTasks=${longTasks} tbt=${tbtMs.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(LOAD_BUDGET_MS)
      },
      PERF_TIMEOUT,
    )
  }
})
