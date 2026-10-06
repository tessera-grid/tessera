import { cleanup } from 'vitest-browser-react'
import { beforeAll, describe, expect, test } from 'vitest'

import {
  headCells,
  measureRenderWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import { makeData } from '../../__mocks__/data'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  LOAD_BUDGET_MS,
  NO_PLUGINS,
  PAGED,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'

// Производительность ПЕРВОЙ ОТРИСОВКИ (mount → первый кадр). Половина перф-матрицы:
// операция «отрисовка» × объём (небольшой/большой) × плагины (без/все).
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
  /** Данные генерируются до замера: меряется монтирование, а не faker. */
  pregenerated?: boolean
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
  {
    // Колонка раскрытия по условию (ADR 0050): проход по корням и одна повторная
    // отрисовка после монтирования — та же цена, что у P6.
    id: 'SC10',
    label: 'большая выборка, все плагины, колонка раскрытия по условию',
    args: { ...LARGE, ...ALL_PLUGINS, enableRowExpanding: true },
    regressionCeiling: 500,
  },
  {
    id: 'P9',
    label: 'много строк, без плагинов',
    args: { ...PAGED, ...NO_PLUGINS },
    pregenerated: true,
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
        const dataOverride = c.pregenerated
          ? makeData({ shape: 'flat', count: Number(c.args.dataCount) })
          : undefined
        const result = await measureRenderWork(
          () => renderGrid({ ...c.args, dataOverride }),
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
            c.args.columnCount === LARGE.columnCount
              ? '1000×1000'
              : c.args.dataCount === PAGED.dataCount
                ? '30×100 000'
                : '30×500',
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

// Ленивые дети (ADR 0054, RE39): монтирование 100 000 корней с `hasChildren` против
// той же выборки без него. Худший случай условия колонки: помечена только последняя
// строка — проверка «есть ли раскрываемые» проходит все корни.
describe('Производительность первой отрисовки — ленивые дети', () => {
  test(
    'RE39: монтирование 100 000 строк с hasChildren не хуже базы без него',
    async () => {
      const dataOverride = makeData({
        shape: 'flat',
        count: PAGED.dataCount,
      })
      const last = PAGED.dataCount - 1
      const measure = async (lazy: boolean) => {
        const result = await measureRenderWork(
          () =>
            renderGrid({
              ...PAGED,
              ...NO_PLUGINS,
              enableRowExpanding: true,
              dataOverride,
              ...(lazy
                ? {
                    rowExpandingHasChildren: (row: { index: number }) =>
                      row.index === last,
                    rowExpandingLoadChildren: () => [],
                  }
                : {}),
            }),
          () => headCells().length > 0,
          { warmup: false },
        )
        cleanup()
        return result
      }
      const base = await measure(false)
      const lazy = await measure(true)
      // Шум замера монтирования — до ~30% между прогонами; больше — регрессия.
      const ceiling = Math.max(base.longestMs * 1.3, base.longestMs + 40)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'render',
          size: '30×100 000',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: false,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              budgetMs: gated ? ceiling : LOAD_BUDGET_MS,
              pass: !gated || r.longestMs <= ceiling,
              ...r,
            },
          ],
        })
      await record('RE39-base', 'раскрытие без hasChildren', base, false)
      await record(
        'RE39',
        'раскрытие с hasChildren (помечена последняя)',
        lazy,
        true,
      )

      expect(
        lazy.longestMs,
        `с hasChildren longest=${lazy.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})
